<?php

namespace App\Http\Controllers;

use App\Models\Group;
use App\Models\GroupWantedItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Validation\ValidationException;

class GroupWantedItemController extends Controller
{
    protected const array QUANTITY_RULES = [['integer', 'strict'], ['between', 1, 2_147_483_647]];

    public function index(): JsonResponse
    {
        $group = request()->attributes->get('group');

        return response()->json($group->wantedItems()->get(['item_id', 'target_quantity']));
    }

    public function update(): JsonResponse|Response
    {
        $goal = request()->validate([
            'item_id' => ['required', ['integer', 'strict'], ['min', 1]],
            'target_quantity' => ['required', ...static::QUANTITY_RULES],
            'expected_quantity' => ['present', 'nullable', ...static::QUANTITY_RULES],
            'exact_item_id' => [['boolean', 'strict']],
        ]);

        $catalogue = File::json(resource_path('assets/data/item_data.json'), JSON_THROW_ON_ERROR);
        $wantedItemData = File::json(resource_path('game/wanted-items.json'), JSON_THROW_ON_ERROR);

        if (! isset($catalogue[$goal['item_id']])
            || ($catalogue[$goal['item_id']]['lastManStanding'] ?? false)
            || in_array($goal['item_id'], $wantedItemData['unavailable'])) {
            throw ValidationException::withMessages(['item_id' => 'Choose an item from the catalogue.']);
        }

        return $this->change(
            $goal['item_id'],
            $goal['target_quantity'],
            $goal['expected_quantity'],
            $wantedItemData['equivalents'],
            ($goal['exact_item_id'] ?? false) && ! is_null($goal['expected_quantity']),
        );
    }

    public function destroy(): JsonResponse|Response
    {
        $validated = request()->validate([
            'expected_quantity' => ['present', 'nullable', ...static::QUANTITY_RULES],
            'exact_item_id' => [['boolean', 'strict']],
        ]);
        $wantedItemData = File::json(resource_path('game/wanted-items.json'), JSON_THROW_ON_ERROR);

        return $this->change(
            (int) request()->route('item'),
            null,
            $validated['expected_quantity'],
            $wantedItemData['equivalents'],
            $validated['exact_item_id'] ?? false,
        );
    }

    /** @param array<int, list<int>> $equivalents */
    protected function canonicalItemId(int $itemId, array $equivalents): int
    {
        foreach ($equivalents as $canonicalItemId => $variants) {
            if (in_array($itemId, $variants)) {
                return $canonicalItemId;
            }
        }

        return $itemId;
    }

    /** @param array<int, list<int>> $equivalents */
    protected function change(int $requestedId, ?int $quantity, ?int $expectedQuantity, array $equivalents, bool $exact): JsonResponse|Response
    {
        $groupId = request()->attributes->get('group')->id;
        $canonicalId = $exact ? $requestedId : $this->canonicalItemId($requestedId, $equivalents);
        $candidateIds = $exact ? [$requestedId] : [$canonicalId, ...($equivalents[$canonicalId] ?? [])];

        return DB::transaction(function () use ($groupId, $requestedId, $canonicalId, $candidateIds, $quantity, $expectedQuantity): JsonResponse|Response {
            $group = Group::query()->lockForUpdate()->findOrFail($groupId);
            $quantities = $group->wantedItems()->whereIn('item_id', $candidateIds)->orderBy('item_id')->pluck('target_quantity', 'item_id');
            $itemId = match (true) {
                $quantities->has($requestedId) => $requestedId,
                $quantities->has($canonicalId) => $canonicalId,
                default => $quantities->keys()->first() ?? $canonicalId,
            };
            $currentQuantity = $quantities->get($itemId);

            if ($currentQuantity !== $expectedQuantity && $currentQuantity !== $quantity) {
                return response()->json(['item_id' => $itemId, 'target_quantity' => $currentQuantity], Response::HTTP_CONFLICT);
            }

            if (is_null($quantity)) {
                $group->wantedItems()->where('item_id', '=', $itemId)->delete();

                return response()->noContent();
            }

            $goal = ['item_id' => $itemId, 'target_quantity' => $quantity];
            GroupWantedItem::upsert(
                [...$goal, 'group_id' => $groupId],
                uniqueBy: ['group_id', 'item_id'],
                update: ['target_quantity'],
            );

            return response()->json($goal);
        }, attempts: 3);
    }
}
