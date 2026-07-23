<?php

use App\Models\Group;
use App\Models\Member;

it('backfills existing member colors in alphabetical order', function () {
    $migration = require database_path('migrations/2026_07_16_000000_add_color_hue_degrees_to_members_table.php');

    $group = Group::create([
        'name' => 'color-migration-test',
        'hash' => 'color-migration-test-token',
    ]);

    Member::create([
        'group_id' => $group->id,
        'name' => Member::SHARED_MEMBER,
    ]);

    foreach (['Charlie', 'Alice', 'Bob'] as $memberName) {
        Member::create([
            'group_id' => $group->id,
            'name' => $memberName,
        ]);
    }

    $migration->up();

    expect(
        Member::where('group_id', '=', $group->id)
            ->where('name', '!=', Member::SHARED_MEMBER)
            ->orderBy('name')
            ->pluck('color_hue_degrees', 'name')
            ->all()
    )->toBe([
        'Alice' => 330,
        'Bob' => 100,
        'Charlie' => 230,
    ]);
});

it('persists initial member colors in alphabetical order', function () {
    $this->postJson('/api/create-group', [
        'name' => 'color-test',
        'member_names' => ['Charlie', 'Alice', 'Bob'],
    ])->assertCreated();

    $group = Group::where('name', '=', 'color-test')->firstOrFail();

    expect(
        Member::where('group_id', '=', $group->id)
            ->where('name', '!=', Member::SHARED_MEMBER)
            ->orderBy('id')
            ->pluck('name')
            ->all()
    )->toBe(['Charlie', 'Alice', 'Bob']);

    expect(
        Member::where('group_id', '=', $group->id)
            ->where('name', '!=', Member::SHARED_MEMBER)
            ->orderBy('name')
            ->pluck('color_hue_degrees', 'name')
            ->all()
    )->toBe([
        'Alice' => 330,
        'Bob' => 100,
        'Charlie' => 230,
    ]);
});

it('swaps persisted member colors', function () {
    $createGroupResponse = $this->postJson('/api/create-group', [
        'name' => 'color-swap-test',
        'member_names' => ['Charlie', 'Alice'],
    ])->assertCreated();

    $this->putJson('/api/group/color-swap-test/update-member-color', [
        'name' => 'Alice',
        'color_hue_degrees' => 100,
    ], [
        'Authorization' => $createGroupResponse->json('token'),
    ])->assertOk()->assertExactJson([
        'updated' => [
            'name' => 'Alice',
            'color_hue_degrees' => 100,
        ],
        'swapped' => [
            'name' => 'Charlie',
            'color_hue_degrees' => 330,
        ],
    ]);

    $group = Group::where('name', '=', 'color-swap-test')->firstOrFail();

    expect(
        Member::where('group_id', '=', $group->id)
            ->where('name', '!=', Member::SHARED_MEMBER)
            ->orderBy('name')
            ->pluck('color_hue_degrees', 'name')
            ->all()
    )->toBe([
        'Alice' => 100,
        'Charlie' => 330,
    ]);
});
