<?php

namespace App\Http\Controllers;

use App\Domain\MemberSnapshotCreator;
use App\Domain\MemberUpdates;
use App\Domain\MemberUpdateValidation;
use App\Domain\SkillHistory;
use App\Domain\Validators;
use App\Models\CollectionLog;
use App\Models\Member;
use App\Models\SkillStat;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
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
        $group = $request->attributes->get('group');

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

        $memberCount = Member::where('group_id', '=', $group->id)
            ->where('name', '!=', Member::SHARED_MEMBER)
            ->distinct('name')
            ->count('name');

        if ($memberCount >= 5) {
            return response()->json([
                'error' => 'Group already has maximum allowed members',
            ], 400);
        }

        $sameNameCount = Member::where('group_id', '=', $group->id)
            ->where('name', '=', $name)
            ->count();

        if ($sameNameCount > 0) {
            return response()->json([
                'error' => "Member name {$name} is taken in this group",
            ], 400);
        }

        $takenHues = Member::where('group_id', '=', $group->id)
            ->where('name', '!=', Member::SHARED_MEMBER)
            ->whereNotNull('color_hue_degrees')
            ->pluck('color_hue_degrees')
            ->all();

        $colorHueDegrees = collect(Member::DEFAULT_COLOR_HUES)
            ->first(fn (int $colorHueDegrees): bool => ! in_array($colorHueDegrees, $takenHues))
            ?? Member::DEFAULT_COLOR_HUES[0];

        Member::create([
            'group_id' => $group->id,
            'name' => $name,
            'color_hue_degrees' => $colorHueDegrees,
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

        $members = Member::where('group_id', '=', $groupId)
            ->where('name', '=', $name)
            ->get();

        if ($members->isEmpty()) {
            return response()->json(['error' => 'Member not found'], 404);
        }

        DB::transaction(function () use ($members): void {
            foreach ($members as $member) {
                SkillStat::where('member_id', '=', $member->id)->delete();
                CollectionLog::where('member_id', '=', $member->id)->delete();
                $member->delete();
            }
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

    public function updateGroupMember(): JsonResponse
    {
        $validated = MemberUpdateValidation::validate(request()->all());
        $groupId = request()->attributes->get('group')->id;

        return DB::transaction(function () use ($groupId, $validated): JsonResponse {
            $member = Member::where('group_id', '=', $groupId)
                ->where('name', '=', $validated['name'])
                ->lockForUpdate()
                ->first();

            if (is_null($member)) {
                return response()->json(['error' => 'Player is not a member of this group'], 401);
            }

            $member->update(['last_online_at' => now()->toDateTimeString()]);
            MemberUpdates::apply($member, $validated);

            return response()->json(null);
        });
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
            ->get();

        return response()->json($members->map(function ($member) use ($fromTime) {
            $properties = $member->properties->keyBy('key');
            $lastUpdated = $properties->max('updated_at');

            $data = [
                'name' => $member->name,
                'color_hue_degrees' => $member->color_hue_degrees,
                'last_updated' => is_null($lastUpdated) ? null : Carbon::make($lastUpdated)->toIso8601ZuluString(),
                'last_online_at' => is_null($member->last_online_at) ? null : Carbon::make($member->last_online_at)->toIso8601ZuluString(),
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
        }));
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

    public function getSkillData(): JsonResponse
    {
        $request = request();
        $validated = $request->validate([
            'start' => ['sometimes', 'required', 'date', ['before', 'end']],
            'end' => ['required', 'date', ['before_or_equal', 'now']],
        ]);

        return response()->json(app(SkillHistory::class)->get(
            $request->attributes->get('group'),
            isset($validated['start']) ? CarbonImmutable::parse($validated['start'])->utc() : null,
            CarbonImmutable::parse($validated['end'])->utc(),
        ));
    }

    public function getCollectionLog(Request $request): Collection
    {
        $groupId = $request->attributes->get('group')->id;

        return CollectionLog::with('member')
            ->whereHas('member', function ($query) use ($groupId) {
                $query->where('group_id', '=', $groupId);
            })
            ->get()->groupBy('member.name')->map->pluck('item_count', 'item_id');
    }

    public function getSnapshots(Request $request): JsonResponse
    {
        $groupId = $request->attributes->get('group')->id;
        $validated = $request->validate([
            'markers' => [
                'sometimes',
                'array',
            ],
            'markers.*' => ['numeric'],
        ]);
        $markers = $validated['markers'] ?? [];

        $snapshots = Member::where('group_id', '=', $groupId)
            ->whereHas('snapshots')
            ->select(['id', 'name'])
            ->get()
            ->mapWithKeys(function (Member $member) use ($markers): array {
                $lastWeek = $member->snapshots()
                    ->orderBy('created_at')
                    ->orderBy('id')
                    ->first();
                $lastVisit = $lastWeek;

                if (isset($markers[$member->name])) {
                    $lastVisit = $member->snapshots()
                        ->where('snapshot->timestamp', '<=', (int) $markers[$member->name])
                        ->orderByDesc('snapshot->timestamp')
                        ->orderByDesc('id')
                        ->first() ?? $lastWeek;
                }

                return [$member->name => [
                    'lastVisit' => $lastVisit->snapshot,
                    'lastWeek' => $lastWeek->snapshot,
                ]];
            });

        return response()->json((object) $snapshots->all());
    }

    public function createSnapshot(Request $request, MemberSnapshotCreator $creator): JsonResponse
    {
        $groupId = $request->attributes->get('group')->id;
        $validated = $request->validate([
            'name' => ['required', 'string'],
        ]);
        $member = Member::where('group_id', '=', $groupId)
            ->where('name', '=', $validated['name'])
            ->first();

        if (! $member) {
            return response()->json(['error' => 'Member not found'], 404);
        }

        $snapshot = $creator->create($member);

        if (! $snapshot) {
            return response()->json(['error' => 'Member skills are unavailable'], 409);
        }

        return response()->json($snapshot->snapshot, 201);
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
            $response = Http::timeout(10)->withUserAgent('GIM hub (https://gim-hub.com)')->get(
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

    public function updateMemberColor(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string',
            'color_hue_degrees' => 'required|integer|in:330,100,230,170,40',
        ]);

        $name = $validated['name'];
        $hue = $validated['color_hue_degrees'];
        $groupId = $request->attributes->get('group')->id;

        if ($name === Member::SHARED_MEMBER) {
            return response()->json([
                'error' => "Member name {$name} not allowed",
            ], 400);
        }

        $result = DB::transaction(function () use ($name, $hue, $groupId): array|false {
            $member = Member::where('group_id', '=', $groupId)
                ->where('name', '=', $name)
                ->lockForUpdate()
                ->first();

            if (! $member) {
                return false;
            }

            $swapped = null;

            $occupant = Member::where('group_id', '=', $groupId)
                ->where('name', '!=', $name)
                ->where('name', '!=', Member::SHARED_MEMBER)
                ->where('color_hue_degrees', '=', $hue)
                ->lockForUpdate()
                ->first();

            if ($occupant) {
                $oldMemberHue = $member->color_hue_degrees;
                $occupant->update(['color_hue_degrees' => $oldMemberHue]);
                $swapped = ['name' => $occupant->name, 'color_hue_degrees' => $oldMemberHue];
            }

            $member->update(['color_hue_degrees' => $hue]);

            return ['name' => $name, 'color_hue_degrees' => $hue, 'swapped' => $swapped];
        });

        if ($result === false) {
            return response()->json(['error' => 'Member not found'], 404);
        }

        $response = [
            'updated' => [
                'name' => $result['name'],
                'color_hue_degrees' => $result['color_hue_degrees'],
            ],
        ];

        if ($result['swapped'] !== null) {
            $response['swapped'] = $result['swapped'];
        }

        return response()->json($response, 200);
    }
}
