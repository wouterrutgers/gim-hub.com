<?php

namespace App\Http\Controllers;

use App\Domain\Validators;
use App\Enums\AggregatePeriod;
use App\Models\CollectionLog;
use App\Models\Member;
use App\Models\SkillStat;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Throwable;

class GroupMemberController extends Controller
{
    public function addGroupMember(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string',
        ]);

        $name = $validated['name'];
        $groupId = $request->attributes->get('group')->id;

        if ($name === Member::SHARED_MEMBER) {
            return response()->json([
                'error' => "Member name {$name} not allowed",
            ], 400);
        }

        if (! Validators::validName($name)) {
            return response()->json([
                'error' => "Member name {$name} is not valid",
            ], 400);
        }

        $memberCount = Member::where('group_id', '=', $groupId)
            ->where('name', '!=', Member::SHARED_MEMBER)
            ->count();

        if ($memberCount >= 5) {
            return response()->json([
                'error' => 'Group already has maximum allowed members',
            ], 400);
        }

        $sameNameCount = Member::where('group_id', '=', $groupId)
            ->where('name', '=', $name)
            ->count();

        if ($sameNameCount > 0) {
            return response()->json([
                'error' => "Member name {$name} is taken in this group",
            ], 400);
        }

        Member::create([
            'group_id' => $groupId,
            'name' => $name,
        ]);

        return response()->json(null, 201);
    }

    public function deleteGroupMember(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string',
        ]);

        $name = $validated['name'];
        $groupId = $request->attributes->get('group')->id;

        if ($name === Member::SHARED_MEMBER) {
            return response()->json([
                'error' => "Member name {$name} not allowed",
            ], 400);
        }

        DB::transaction(function () use ($groupId, $name): void {
            $member = Member::where('group_id', '=', $groupId)
                ->where('name', '=', $name)
                ->firstOrFail();

            $memberId = $member->id;

            SkillStat::where('member_id', '=', $memberId)->delete();
            CollectionLog::where('member_id', '=', $memberId)->delete();

            $member->delete();
        });

        return response()->json(null, 200);
    }

    public function renameGroupMember(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'original_name' => 'required|string',
            'new_name' => 'required|string',
        ]);

        $originalName = $validated['original_name'];
        $newName = $validated['new_name'];
        $groupId = $request->attributes->get('group')->id;

        if ($originalName === Member::SHARED_MEMBER || $newName === Member::SHARED_MEMBER) {
            return response()->json([
                'error' => 'Member name '.Member::SHARED_MEMBER.' not allowed',
            ], 400);
        }

        if (! Validators::validName($newName)) {
            return response()->json([
                'error' => "Member name {$newName} is not valid",
            ], 400);
        }

        $sameNameCount = Member::where('group_id', '=', $groupId)
            ->where('name', '=', $newName)
            ->count();

        if ($sameNameCount > 0) {
            return response()->json([
                'error' => "Member name {$newName} is taken in this group",
            ], 400);
        }

        $updated = Member::where('group_id', '=', $groupId)
            ->where('name', '=', $originalName)
            ->update(['name' => $newName]);

        if ($updated === 0) {
            return response()->json(['error' => 'Member not found'], 404);
        }

        return response()->json(null, 200);
    }

    public function updateGroupMember(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string',
            'stats' => 'nullable|array',
            'coordinates' => 'nullable|array',
            'skills' => 'nullable|array',
            'quests' => 'nullable|array',
            'inventory' => 'nullable|array',
            'equipment' => 'nullable|array',
            'bank' => 'nullable|array',
            'bank_partial' => 'nullable|array',
            'shared_bank' => 'nullable|array',
            'rune_pouch' => 'nullable|array',
            'seed_vault' => 'nullable|array',
            'potion_storage' => 'nullable|array',
            'poh_costume_room' => 'nullable|array',
            'plank_sack' => 'nullable|array',
            'master_scroll_book' => 'nullable|array',
            'essence_pouches' => 'nullable|array',
            'tackle_box' => 'nullable|array',
            'tackle_box_partial' => 'nullable|array',
            'coal_bag' => 'nullable|array',
            'fish_barrel' => 'nullable|array',
            'quiver' => 'nullable|array',
            'diary_vars' => 'nullable|array',
            'collection_log_v2' => 'nullable|array',
            'interacting' => 'nullable',
        ]);

        $name = $validated['name'];
        $groupId = $request->attributes->get('group')->id;

        $member = Member::where('group_id', '=', $groupId)
            ->where('name', '=', $name)
            ->first();

        if (is_null($member)) {
            return response()->json([
                'error' => 'Player is not a member of this group',
            ], 401);
        }

        $validatorBounds = [
            ['stats', 7, 7],
            ['coordinates', 4, 4],
            ['skills', 24, 24],
            ['quests', 0, 250],
            ['inventory', 56, 56],
            ['equipment', 28, 28],
            ['bank', 0, 3000],
            ['bank_partial', 0, 3000],
            ['shared_bank', 0, 1000],
            ['rune_pouch', 6, 8],
            ['seed_vault', 0, 500],
            ['potion_storage', 0, 2000],
            ['poh_costume_room', 0, 2000],
            ['plank_sack', 0, 14],
            ['master_scroll_book', 0, 40],
            ['essence_pouches', 0, 16],
            ['tackle_box', 0, 100],
            ['tackle_box_partial', 0, 100],
            ['coal_bag', 0, 2],
            ['fish_barrel', 0, 100],
            ['quiver', 2, 2],
            ['deposited', 0, 200],
            ['diary_vars', 0, 62],
        ];
        foreach ($validatorBounds as [$propName, $minLength, $maxLength]) {
            Validators::validateMemberPropLength($propName, $validated[$propName] ?? null, $minLength, $maxLength);
        }

        $collectionLogData = $validated['collection_log_v2'] ?? null;

        DB::transaction(function () use ($member, $groupId, $validated, $collectionLogData): void {
            foreach (Member::PROPERTY_KEYS as $propertyKey) {
                $partialKey = Member::PARTIAL_PROPERTY_KEYS[$propertyKey] ?? null;

                if (isset($validated[$propertyKey])) {
                    $member->properties()->updateOrCreate(
                        ['key' => $propertyKey],
                        ['value' => $validated[$propertyKey]]
                    );
                } elseif (isset($partialKey) && isset($validated[$partialKey])) {
                    $fullFlat = [];
                    $fullFlatProperty = $member->getProperty($propertyKey);
                    if (isset($fullFlatProperty)) {
                        $fullFlat = $fullFlatProperty->value;
                    }

                    $partialFlat = $validated[$partialKey];

                    $partialReshaped = [];

                    for ($i = 0; $i < count($partialFlat) - 1; $i += 2) {
                        $itemID = $partialFlat[$i];
                        $quantity = $partialFlat[$i + 1];
                        $partialReshaped[$itemID] = $quantity;
                    }

                    for ($i = 0; $i < count($fullFlat) - 1; $i += 2) {
                        $itemID = $fullFlat[$i];
                        $quantity = $fullFlat[$i + 1];

                        $fullFlat[$i + 1] = max(0, $quantity + ($partialReshaped[$itemID] ?? 0));

                        unset($partialReshaped[$itemID]);
                    }

                    foreach ($partialReshaped as $itemID => $quantity) {
                        $fullFlat[] = $itemID;
                        $fullFlat[] = max(0, $quantity);
                    }

                    $member->properties()->updateOrCreate(
                        ['key' => $propertyKey],
                        ['value' => $fullFlat]
                    );
                }
            }

            if (isset($validated['interacting'])) {
                $member->properties()->updateOrCreate(
                    ['key' => 'interacting'],
                    ['value' => $validated['interacting']]
                );
            }

            if (! empty($validated['deposited'] ?? [])) {
                $this->depositItems($groupId, $member->name, $validated['deposited']);
            }

            if (! empty($validated['shared_bank'] ?? [])) {
                $sharedMember = Member::where('group_id', '=', $groupId)
                    ->where('name', '=', Member::SHARED_MEMBER)
                    ->first();

                $sharedMember?->properties()->updateOrCreate(
                    ['key' => 'bank'],
                    ['value' => $validated['shared_bank']]
                );
            }

            if (! is_null($collectionLogData)) {
                $this->updateCollectionLog($member, $collectionLogData);
            }
        });

        return response()->json(null);
    }

    protected function updateCollectionLog(Member $member, array $collectionLogData): void
    {
        foreach (array_chunk($collectionLogData, 2) as [$itemId, $count]) {
            $member->collectionLogs()->updateOrCreate([
                'item_id' => $itemId,
            ], [
                'item_count' => $count,
            ]);
        }
    }

    protected function depositItems(int $groupId, string $memberName, array $deposited): void
    {
        if (empty($deposited)) {
            return;
        }

        $member = Member::where('group_id', '=', $groupId)
            ->where('name', '=', $memberName)
            ->first();

        if (is_null($member)) {
            return;
        }

        $member->loadMissing('properties');
        $bankProperty = $member->getProperty('bank');
        $bankItems = $bankProperty?->value ?? [];

        $depositedMap = [];
        for ($i = 0; $i < count($deposited); $i += 2) {
            $itemId = $deposited[$i];
            $quantity = $deposited[$i + 1];
            $depositedMap[$itemId] = $quantity;
        }

        for ($i = 0; $i < count($bankItems); $i += 2) {
            $itemId = $bankItems[$i];
            if (isset($depositedMap[$itemId])) {
                $bankItems[$i + 1] += $depositedMap[$itemId];
                unset($depositedMap[$itemId]);
            }
        }

        foreach ($depositedMap as $itemId => $quantity) {
            if ($itemId === 0 || $quantity <= 0) {
                continue;
            }
            $bankItems[] = $itemId;
            $bankItems[] = $quantity;
        }

        $member->properties()->updateOrCreate(
            ['key' => 'bank'],
            ['value' => $bankItems]
        );
    }

    public function getGroupData(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from_time' => 'required|date',
        ]);

        $fromTime = Carbon::parse($validated['from_time']);
        $groupId = $request->attributes->get('group')->id;

        $members = Member::where('group_id', '=', $groupId)
            ->with('properties')
            ->get()
            ->map(function ($member) use ($fromTime) {
                $properties = $member->properties->keyBy('key');
                $lastUpdated = $properties->max('updated_at');

                $data = [
                    'name' => $member->name,
                    'last_updated' => is_null($lastUpdated) ? null : Carbon::make($lastUpdated)->toIso8601ZuluString(),
                    'shared_bank' => null,
                    'deposited' => null,
                    'collection_log' => null,
                ];

                foreach (Member::PROPERTY_KEYS as $key) {
                    $property = $properties->get($key);
                    if ($property && $property->updated_at >= $fromTime) {
                        $value = $property->value;
                        if ($key === 'interacting') {
                            $value = $this->withInteractingTimestamp($value, $property->updated_at);
                        }
                        $data[$key] = $value;
                    } else {
                        $data[$key] = null;
                    }
                }

                return $data;
            });

        return response()->json($members);
    }

    protected function withInteractingTimestamp($interacting, $lastUpdated)
    {
        if (is_null($interacting) || is_null($lastUpdated)) {
            return $interacting;
        }

        if (is_array($interacting)) {
            $interacting['last_updated'] = Carbon::make($lastUpdated)->toIso8601ZuluString();
        }

        return $interacting;
    }

    public function getSkillData(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'period' => 'required|in:Day,Week,Month,Year',
        ]);

        $groupId = $request->attributes->get('group')->id;
        $period = $validated['period'];

        $aggregatePeriod = match ($period) {
            'Day' => AggregatePeriod::Day,
            'Week' => AggregatePeriod::Month,
            'Month' => AggregatePeriod::Month,
            'Year' => AggregatePeriod::Year,
            default => AggregatePeriod::Day,
        };

        $members = Member::where('group_id', '=', $groupId)
            ->with(['skillStats' => function ($query) use ($aggregatePeriod) {
                $query->where('type', '=', $aggregatePeriod->value)
                    ->orderBy('created_at');
            }])
            ->get();

        $memberData = [];
        foreach ($members as $member) {
            $skillData = $member->skillStats->map(function ($stat) {
                return [
                    'time' => Carbon::make($stat->created_at)->toIso8601ZuluString(),
                    'data' => $stat->skills,
                ];
            })->toArray();

            $memberData[] = [
                'name' => $member->name,
                'skill_data' => $skillData,
            ];
        }

        return response()->json(array_values(array_filter($memberData, function ($member) {
            return ! empty($member['skill_data']);
        })));
    }

    public function getCollectionLog(Request $request): Collection
    {
        $groupId = $request->attributes->get('group')->id;

        return CollectionLog::with('member')
            ->whereHas('member.group', function ($query) use ($groupId) {
                $query->where('groups.id', '=', $groupId);
            })
            ->get()->groupBy('member.name')->map->pluck('item_count', 'item_id');
    }

    public function getHiscores(Request $request): JsonResponse
    {
        $groupId = $request->attributes->get('group')->id;

        $validated = $request->validate([
            'name' => 'required|string',
        ]);

        $member = Member::where('group_id', '=', $groupId)
            ->where('name', '=', $validated['name'])
            ->first();

        try {
            $response = Http::timeout(10)->get(
                'https://secure.runescape.com/m=hiscore_oldschool/index_lite.json?player='.urlencode($member->name)
            );
        } catch (Throwable) {
            return response()->json([
                'error' => 'Failed to fetch hiscores',
            ], 502);
        }

        if ($response->status() === 404) {
            return response()->json([
                'error' => 'User was not found in the hiscores',
            ], 404);
        }

        if (! $response->ok()) {
            return response()->json([
                'error' => 'Failed to fetch hiscores',
            ], 502);
        }

        return response()->json($response->collect('activities')->pluck('score', 'name'));
    }

    public function amILoggedIn(Request $request): JsonResponse
    {
        return response()->json(null, 200);
    }

    public function amIInGroup(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'member_name' => 'required|string',
        ]);

        $memberName = $validated['member_name'];
        $groupId = $request->attributes->get('group')->id;

        $memberExists = Member::where('group_id', '=', $groupId)
            ->where('name', '=', $memberName)
            ->exists();

        if ($memberExists === false) {
            return response()->json([
                'error' => 'Player is not a member of this group',
            ], 401);
        }

        return response()->json(null);
    }
}
