<?php

namespace App\Http\Controllers;

use App\Domain\CollectionLogInfo;
use App\Domain\Validators;
use App\Enums\AggregatePeriod;
use App\Models\CollectionLog;
use App\Models\Member;
use App\Models\NewCollectionLog;
use App\Models\SkillStat;
use Carbon\Carbon;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GroupMemberController extends Controller
{
    public function addGroupMember(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string',
        ]);

        $name = $validated['name'];
        $groupId = app('group')->id;

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
        $groupId = app('group')->id;

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
            NewCollectionLog::where('member_id', '=', $memberId)->delete();

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
        $groupId = app('group')->id;

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
            'shared_bank' => 'nullable|array',
            'rune_pouch' => 'nullable|array',
            'seed_vault' => 'nullable|array',
            'quiver' => 'nullable|array',
            'deposited' => 'nullable|array',
            'diary_vars' => 'nullable|array',
            'collection_log' => 'nullable|array',
            'collection_log_new' => 'nullable|array',
            'interacting' => 'nullable',
        ]);

        $name = $validated['name'];
        $groupId = app('group')->id;

        $member = Member::where('group_id', '=', $groupId)
            ->where('name', '=', $name)
            ->first();

        if (is_null($member)) {
            return response()->json([
                'error' => 'Player is not a member of this group',
            ], 401);
        }

        Validators::validateMemberPropLength('stats', $validated['stats'] ?? null, 7, 7);
        Validators::validateMemberPropLength('coordinates', $validated['coordinates'] ?? null, 3, 3);
        Validators::validateMemberPropLength('skills', $validated['skills'] ?? null, 23, 24);
        Validators::validateMemberPropLength('quests', $validated['quests'] ?? null, 0, 250);
        Validators::validateMemberPropLength('inventory', $validated['inventory'] ?? null, 56, 56);
        Validators::validateMemberPropLength('equipment', $validated['equipment'] ?? null, 28, 28);
        Validators::validateMemberPropLength('bank', $validated['bank'] ?? null, 0, 3000);
        Validators::validateMemberPropLength('shared_bank', $validated['shared_bank'] ?? null, 0, 1000);
        Validators::validateMemberPropLength('rune_pouch', $validated['rune_pouch'] ?? null, 6, 8);
        Validators::validateMemberPropLength('seed_vault', $validated['seed_vault'] ?? null, 0, 500);
        Validators::validateMemberPropLength('quiver', $validated['quiver'] ?? null, 2, 2);
        Validators::validateMemberPropLength('deposited', $validated['deposited'] ?? null, 0, 200);
        Validators::validateMemberPropLength('diary_vars', $validated['diary_vars'] ?? null, 0, 62);

        $collectionLogInfo = CollectionLogInfo::make();
        $collectionLogData = $validated['collection_log'] ?? null;

        try {
            if (! is_null($collectionLogData)) {
                foreach ($collectionLogData as $key => $log) {
                    $pageId = $collectionLogInfo->pageNameToId($log['page_name'] ?? '');
                    if (is_null($pageId)) {
                        throw new Exception("Invalid collection log page: {$log['page_name']}");
                    }

                    if (isset($log['items'])) {
                        $numberOfItems = count($log['items']) / 2;
                        $maxItems = $collectionLogInfo->numberOfItemsInPage($pageId);
                        if ($numberOfItems > $maxItems) {
                            throw new Exception("{$numberOfItems} is too many items for collection log {$log['page_name']}");
                        }

                        for ($i = 0; $i < count($log['items']); $i += 2) {
                            $itemId = $collectionLogInfo->remapItemId($log['items'][$i]);
                            $collectionLogData[$key]['items'][$i] = $itemId;

                            if (! $collectionLogInfo->hasItem($pageId, $itemId)) {
                                throw new Exception("Collection log {$log['page_name']} does not have item id {$itemId}");
                            }
                        }
                    }
                }
            }
        } catch (Exception $e) {
            return response()->json([
                'error' => $e->getMessage(),
            ], 400);
        }

        DB::transaction(function () use ($member, $groupId, $validated, $collectionLogInfo, $collectionLogData): void {
            $now = now();

            if (! is_null($validated['stats'] ?? null)) {
                $member->stats = $validated['stats'];
                $member->stats_last_update = $now;
            }
            if (! is_null($validated['coordinates'] ?? null)) {
                $member->coordinates = $validated['coordinates'];
                $member->coordinates_last_update = $now;
            }
            if (! is_null($validated['skills'] ?? null)) {
                $member->skills = $validated['skills'];
                $member->skills_last_update = $now;
            }
            if (! is_null($validated['quests'] ?? null)) {
                $member->quests = $validated['quests'];
                $member->quests_last_update = $now;
            }
            if (! is_null($validated['inventory'] ?? null)) {
                $member->inventory = $validated['inventory'];
                $member->inventory_last_update = $now;
            }
            if (! is_null($validated['equipment'] ?? null)) {
                $member->equipment = $validated['equipment'];
                $member->equipment_last_update = $now;
            }
            if (! is_null($validated['bank'] ?? null)) {
                $member->bank = $validated['bank'];
                $member->bank_last_update = $now;
            }
            if (! is_null($validated['rune_pouch'] ?? null)) {
                $member->rune_pouch = $validated['rune_pouch'];
                $member->rune_pouch_last_update = $now;
            }
            if (! is_null($validated['seed_vault'] ?? null)) {
                $member->seed_vault = $validated['seed_vault'];
                $member->seed_vault_last_update = $now;
            }
            if (! is_null($validated['quiver'] ?? null)) {
                $member->quiver = $validated['quiver'];
                $member->quiver_last_update = $now;
            }
            if (! is_null($validated['diary_vars'] ?? null)) {
                $member->diary_vars = $validated['diary_vars'];
                $member->diary_vars_last_update = $now;
            }
            if (isset($validated['interacting'])) {
                $member->interacting = $validated['interacting'];
                $member->interacting_last_update = $now;
            }

            $member->save();

            if (! empty($validated['deposited'] ?? [])) {
                $this->depositItems($groupId, $member->name, $validated['deposited']);
            }

            if (! empty($validated['shared_bank'] ?? [])) {
                Member::where('group_id', '=', $groupId)
                    ->where('name', '=', Member::SHARED_MEMBER)
                    ->update([
                        'bank' => $validated['shared_bank'],
                        'bank_last_update' => $now,
                    ]);
            }

            if (! is_null($collectionLogData)) {
                $this->updateCollectionLog($groupId, $member, $collectionLogData, $collectionLogInfo);
            }

            if (! empty($validated['collection_log_new'] ?? [])) {
                $this->updateCollectionLogNew($groupId, $member, $validated['collection_log_new'], $collectionLogInfo);
            }
        });

        return response()->json(null, 200);
    }

    protected function updateCollectionLog(int $groupId, Member $member, array $collectionLogs, CollectionLogInfo $collectionLogInfo): void
    {
        $now = now();

        foreach ($collectionLogs as $log) {
            $pageId = $collectionLogInfo->pageNameToId($log['page_name']);

            if (is_null($pageId)) {
                continue;
            }

            CollectionLog::updateOrCreate(
                [
                    'member_id' => $member->id,
                    'collection_page_id' => $pageId,
                ],
                [
                    'items' => $log['items'],
                    'counts' => $log['completion_counts'],
                    'updated_at' => $now,
                ]
            );

            NewCollectionLog::updateOrCreate(
                [
                    'member_id' => $member->id,
                    'collection_page_id' => $pageId,
                ],
                [
                    'items' => [],
                    'updated_at' => $now,
                ]
            );
        }
    }

    protected function updateCollectionLogNew(int $groupId, Member $member, array $collectionLogNew, CollectionLogInfo $collectionLogInfo): void
    {
        $now = now();

        $itemIds = [];
        foreach ($collectionLogNew as $itemName) {
            $itemId = $collectionLogInfo->itemNameToId($itemName);
            if (is_null($itemId)) {
                throw new Exception("{$itemName} is not a known collection log item");
            }
            $itemIds[] = $itemId;
        }

        $pageIdsToItemIds = [];
        foreach ($itemIds as $itemId) {
            $pageIds = $collectionLogInfo->pageIdsForItem($itemId);
            foreach ($pageIds as $pageId) {
                if (! isset($pageIdsToItemIds[$pageId])) {
                    $pageIdsToItemIds[$pageId] = [];
                }
                $pageIdsToItemIds[$pageId][$itemId] = true;
            }
        }

        foreach ($pageIdsToItemIds as $pageId => $pageItemIds) {
            $existingItems = $this->getCollectionNewForPage($member->id, $pageId);
            $combinedItems = array_values(array_unique(array_merge($existingItems, array_keys($pageItemIds))));

            NewCollectionLog::updateOrCreate(
                [
                    'member_id' => $member->id,
                    'collection_page_id' => $pageId,
                ],
                [
                    'items' => $combinedItems,
                    'updated_at' => $now,
                ]
            );
        }
    }

    protected function getCollectionNewForPage(int $memberId, int $pageId): array
    {
        $result = NewCollectionLog::where('member_id', '=', $memberId)
            ->where('collection_page_id', '=', $pageId)
            ->value('items');

        return $result ?? [];
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

        $bankItems = $member->bank ?? [];

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

        $member->bank = $bankItems;
        $member->bank_last_update = now();
        $member->save();
    }

    public function getGroupData(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from_time' => 'required|date',
        ]);

        $fromTime = Carbon::parse($validated['from_time']);
        $groupId = app('group')->id;

        $members = Member::where('group_id', '=', $groupId)
            ->get()
            ->map(function ($member) use ($fromTime) {
                $dates = [
                    $member->stats_last_update,
                    $member->coordinates_last_update,
                    $member->skills_last_update,
                    $member->quests_last_update,
                    $member->inventory_last_update,
                    $member->equipment_last_update,
                    $member->bank_last_update,
                    $member->rune_pouch_last_update,
                    $member->interacting_last_update,
                    $member->seed_vault_last_update,
                    $member->quiver_last_update,
                    $member->diary_vars_last_update,
                ];
                $lastUpdated = collect($dates)
                    ->filter(fn ($d) => ! is_null($d))
                    ->max();

                return [
                    'name' => $member->name,
                    'last_updated' => is_null($lastUpdated) ? null : Carbon::make($lastUpdated)->toIso8601ZuluString(),
                    'stats' => (! is_null($member->stats_last_update) && $member->stats_last_update >= $fromTime) ? $member->stats : null,
                    'coordinates' => (! is_null($member->coordinates_last_update) && $member->coordinates_last_update >= $fromTime) ? $member->coordinates : null,
                    'skills' => (! is_null($member->skills_last_update) && $member->skills_last_update >= $fromTime) ? $member->skills : null,
                    'quests' => (! is_null($member->quests_last_update) && $member->quests_last_update >= $fromTime) ? $member->quests : null,
                    'inventory' => (! is_null($member->inventory_last_update) && $member->inventory_last_update >= $fromTime) ? $member->inventory : null,
                    'equipment' => (! is_null($member->equipment_last_update) && $member->equipment_last_update >= $fromTime) ? $member->equipment : null,
                    'bank' => (! is_null($member->bank_last_update) && $member->bank_last_update >= $fromTime) ? $member->bank : null,
                    'rune_pouch' => (! is_null($member->rune_pouch_last_update) && $member->rune_pouch_last_update >= $fromTime) ? $member->rune_pouch : null,
                    'interacting' => (! is_null($member->interacting_last_update) && $member->interacting_last_update >= $fromTime)
                        ? $this->withInteractingTimestamp($member->interacting, $member->interacting_last_update)
                        : null,
                    'seed_vault' => (! is_null($member->seed_vault_last_update) && $member->seed_vault_last_update >= $fromTime) ? $member->seed_vault : null,
                    'quiver' => (! is_null($member->quiver_last_update) && $member->quiver_last_update >= $fromTime) ? $member->quiver : null,
                    'diary_vars' => (! is_null($member->diary_vars_last_update) && $member->diary_vars_last_update >= $fromTime) ? $member->diary_vars : null,
                    'shared_bank' => null,
                    'deposited' => null,
                    'collection_log' => null,
                    'collection_log_new' => null,
                ];
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

        $groupId = app('group')->id;
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

    public function getCollectionLog(Request $request): JsonResponse
    {
        $groupId = app('group')->id;

        $logs = CollectionLog::with(['member', 'page'])
            ->whereHas('member.group', function ($query) use ($groupId) {
                $query->where('group_id', '=', $groupId);
            })
            ->get();

        $newLogs = NewCollectionLog::with('member')
            ->whereHas('member.group', function ($query) use ($groupId) {
                $query->where('group_id', '=', $groupId);
            })
            ->get();

        $newItemsLookup = [];
        foreach ($newLogs as $newLog) {
            $key = "{$newLog->member_id}_{$newLog->collection_page_id}";
            $newItemsLookup[$key] = $newLog->items ?? [];
        }

        $result = [];
        foreach ($logs as $log) {
            $memberName = $log->member->name;
            $pageId = $log->collection_page_id;
            $memberId = $log->member_id;
            $key = "{$memberId}_{$pageId}";
            $newItems = $newItemsLookup[$key] ?? [];

            $collectionLog = [
                'page_name' => $log->page->name,
                'completion_counts' => $log->counts,
                'items' => $log->items,
                'new_items' => $newItems,
            ];

            if (! isset($result[$memberName])) {
                $result[$memberName] = [];
            }

            $result[$memberName][] = $collectionLog;
        }

        return response()->json($result);
    }

    public function amILoggedIn(Request $request): JsonResponse
    {
        return response()->json(null, 200);
    }

    public function amIInGroup(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string',
        ]);

        $memberName = $validated['name'];
        $groupId = app('group')->id;

        $memberExists = Member::where('group_id', '=', $groupId)
            ->where('name', '=', $memberName)
            ->exists();

        if ($memberExists === false) {
            return response()->json([
                'error' => 'Player is not a member of this group',
            ], 401);
        }

        return response()->json(null, 200);
    }
}
