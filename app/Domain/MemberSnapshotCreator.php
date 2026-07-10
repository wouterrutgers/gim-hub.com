<?php

namespace App\Domain;

use App\Models\Member;
use App\Models\MemberProperty;
use App\Models\MemberSnapshot;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class MemberSnapshotCreator
{
    protected const array SKILLS_IN_BACKEND_ORDER = [
        'Agility',
        'Attack',
        'Construction',
        'Cooking',
        'Crafting',
        'Defence',
        'Farming',
        'Firemaking',
        'Fishing',
        'Fletching',
        'Herblore',
        'Hitpoints',
        'Hunter',
        'Magic',
        'Mining',
        'Prayer',
        'Ranged',
        'Runecraft',
        'Slayer',
        'Smithing',
        'Strength',
        'Thieving',
        'Woodcutting',
        'Sailing',
    ];

    protected const array QUEST_STATUS_BY_INDEX = [
        'IN_PROGRESS',
        'NOT_STARTED',
        'FINISHED',
    ];

    public function create(Member $member): ?MemberSnapshot
    {
        $member->load('properties');

        if (! $this->snapshotProperties($member)) {
            return null;
        }

        $hiscores = $this->hiscores($member);

        return DB::transaction(function () use ($member, $hiscores): ?MemberSnapshot {
            $member = Member::where('id', '=', $member->id)->lockForUpdate()->first();

            if (! $member) {
                return null;
            }

            $member->load(['properties', 'collectionLogs']);
            $properties = $this->snapshotProperties($member);

            if (! $properties) {
                return null;
            }

            $mergedSkills = $this->mergeSkills($properties['skills'], $hiscores);

            if ($mergedSkills !== $properties['skills']) {
                $properties['skillsProperty']->update(['value' => $mergedSkills]);
            }

            return $member->snapshots()->create(['snapshot' => [
                'timestamp' => now()->getTimestampMs(),
                'skills' => $this->skillsSnapshot($mergedSkills),
                'quests' => $this->questsSnapshot($properties['quests']),
                'diaries' => $properties['diaries'],
                'collection' => $member->collectionLogs->pluck('item_count', 'item_id')->all(),
                'bossKc' => $this->bossKcSnapshot($hiscores),
            ]]);
        });
    }

    /**
     * @return array{
     *     skillsProperty: MemberProperty,
     *     skills: array<int, int>,
     *     quests: array<int, int>,
     *     diaries: array<int, int>
     * }|null
     */
    protected function snapshotProperties(Member $member): ?array
    {
        $properties = $member->properties->keyBy('key');
        $skillsProperty = $properties->get('skills');
        $skills = $skillsProperty?->value;

        if (! is_array($skills)) {
            return null;
        }

        return [
            'skillsProperty' => $skillsProperty,
            'skills' => $skills,
            'quests' => $properties->get('quests')?->value ?? [],
            'diaries' => $properties->get('diary_vars')?->value ?? [],
        ];
    }

    protected function hiscores(Member $member): ?Response
    {
        try {
            $response = Http::timeout(10)
                ->connectTimeout(5)
                ->withUserAgent('GIM hub (https://gim-hub.com)')
                ->get('https://secure.runescape.com/m=hiscore_oldschool/index_lite.json?player='.urlencode($member->name));
        } catch (ConnectionException) {
            return null;
        }

        return $response->successful() ? $response : null;
    }

    protected function mergeSkills(array $skills, ?Response $hiscores): array
    {
        if (! $hiscores) {
            return $skills;
        }

        $hiscoresSkills = $hiscores->collect('skills')->pluck('xp', 'name');

        foreach (static::SKILLS_IN_BACKEND_ORDER as $index => $skill) {
            $existingExperience = $skills[$index] ?? 0;
            $skills[$index] = max($existingExperience, $hiscoresSkills->get($skill, $existingExperience));
        }

        return $skills;
    }

    protected function skillsSnapshot(array $skills): array
    {
        $snapshot = [];

        foreach (static::SKILLS_IN_BACKEND_ORDER as $index => $skill) {
            $snapshot[$skill] = $skills[$index] ?? 0;
        }

        return $snapshot;
    }

    protected function questsSnapshot(array $quests): array
    {
        $questIds = array_keys(json_decode(
            file_get_contents(resource_path('assets/data/quest_data.json')),
            true,
            flags: JSON_THROW_ON_ERROR,
        ));
        sort($questIds, SORT_NUMERIC);

        $snapshot = [];

        foreach ($questIds as $index => $questId) {
            $snapshot[$questId] = static::QUEST_STATUS_BY_INDEX[$quests[$index] ?? 1] ?? 'NOT_STARTED';
        }

        return $snapshot;
    }

    protected function bossKcSnapshot(?Response $hiscores): array
    {
        if (! $hiscores) {
            return [];
        }

        return $hiscores->collect('activities')
            ->mapWithKeys(fn (array $activity): array => [
                $activity['name'] => max(0, $activity['score'] ?? 0),
            ])
            ->all();
    }
}
