<?php

namespace Tests;

use App\Models\Group;
use App\Models\Member;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Http::preventStrayRequests();
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

    protected function activityUpdate(string $type, array $data, ?string $identifier = null, int $revision = 1): array
    {
        return [
            'id' => $identifier ?? Str::uuid()->toString(),
            'type' => $type,
            'revision' => $revision,
            'started_at' => now()->getTimestampMs(),
            'occurred_at' => now()->getTimestampMs(),
            'data' => $data,
        ];
    }
}
