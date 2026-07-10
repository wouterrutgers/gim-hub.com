<?php

namespace Tests;

use App\Models\Group;
use App\Models\Member;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Http;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Http::preventStrayRequests();
    }

    /**
     * @return list<string>
     */
    protected function snapshotSkillNames(): array
    {
        return [
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
    }

    /**
     * @param  array<string, int>  $skillExperience
     * @param  list<array{name: string, score: int}>  $activities
     * @return array{skills: list<array{name: string, xp: int}>, activities: list<array{name: string, score: int}>}
     */
    protected function snapshotHiscoresResponse(array $skillExperience = [], array $activities = []): array
    {
        return [
            'skills' => array_map(
                fn (string $skill): array => [
                    'name' => $skill,
                    'xp' => $skillExperience[$skill] ?? 100,
                ],
                $this->snapshotSkillNames(),
            ),
            'activities' => $activities,
        ];
    }

    protected function createSnapshotGroup(string $name = 'test-group'): Group
    {
        return Group::create([
            'name' => $name,
            'hash' => "{$name}-token",
        ]);
    }

    protected function createCompleteSnapshotMember(Group $group, string $name = 'Alice'): Member
    {
        $member = Member::create([
            'group_id' => $group->id,
            'name' => $name,
        ]);

        $member->properties()->createMany([
            ['key' => 'skills', 'value' => array_fill(0, 24, 100)],
            ['key' => 'quests', 'value' => [2]],
            ['key' => 'diary_vars', 'value' => array_fill(0, 62, 0)],
        ]);

        return $member->load('properties');
    }

    /**
     * @return array{
     *     timestamp: int,
     *     skills: array<string, int>,
     *     quests: array<string, string>,
     *     diaries: array<int, int>,
     *     collection: array<string, int>,
     *     bossKc: array<string, int>
     * }
     */
    protected function snapshotPayload(int $timestamp, int $attackExperience = 100): array
    {
        $skills = array_fill_keys($this->snapshotSkillNames(), 100);
        $skills['Attack'] = $attackExperience;

        return [
            'timestamp' => $timestamp,
            'skills' => $skills,
            'quests' => ['0' => 'FINISHED'],
            'diaries' => array_fill(0, 62, 0),
            'collection' => ['4151' => 1],
            'bossKc' => [],
        ];
    }
}
