<?php

use App\Models\Group;
use App\Models\Member;
use Illuminate\Foundation\Testing\RefreshDatabaseState;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Exceptions;

it('stores and returns member properties from supported plugin versions', function (array $additionalProperties): void {
    $group = Group::create(['name' => 'updates-group', 'hash' => 'updates-token']);
    $member = Member::create(['group_id' => $group->id, 'name' => 'Alice']);
    $properties = [
        'stats' => [90, 99, 80, 85, 7000, 100, 301, 75],
        'coordinates' => [3200, 3200, 0, 0],
        'skills' => array_fill(0, 24, 100),
        'quests' => array_fill(0, 250, 2),
        'inventory' => [995, 100, ...array_fill(0, 54, 0)],
        'equipment' => array_fill(0, 28, 0),
        'bank' => [995, 100, ...array_fill(0, 2998, 0)],
        'rune_pouch' => array_fill(0, 8, 0),
        'seed_vault' => array_fill(0, 500, 0),
        'potion_storage' => array_fill(0, 2000, 0),
        'poh_costume_room' => array_fill(0, 2500, 0),
        'plank_sack' => [960, 28],
        'master_scroll_book' => array_fill(0, 40, 0),
        'essence_pouches' => array_fill(0, 16, 0),
        'tackle_box' => [313, 100],
        'tool_leprechaun' => array_fill(0, 24, 0),
        'elnock_inquisitor' => array_fill(0, 6, 0),
        'coal_bag' => [453, 27],
        'fish_barrel' => [383, 28],
        'quiver' => [892, 100],
        'diary_vars' => array_fill(0, 62, 0),
        'interacting' => ['name' => 'Goblin'],
        'timezone' => 'Europe/Amsterdam',
        ...$additionalProperties,
    ];

    $this->withHeader('Authorization', 'updates-token')->postJson('/api/group/updates-group/update-group-member', [
        'name' => $member->name, ...$properties,
    ])->assertSuccessful();

    expect($member->properties()->get()->pluck('value', 'key')->all())->toEqual($properties);

    $this->getJson('/api/group/updates-group/get-group-data?from_time=2000-01-01')
        ->assertSuccessful()
        ->assertJsonPath('0.stats', $properties['stats'])
        ->assertJsonPath('0.rune_pouch', $properties['rune_pouch'])
        ->assertJsonPath('0.skills', $properties['skills'])
        ->assertJsonMissingPath('0.shared_bank')
        ->assertJsonMissingPath('0.deposited')
        ->assertJsonMissingPath('0.collection_log');
})->with([
    'current plugin 27c7ce2' => [[]],
    'pending plugin e432a79' => [[
        'herb_sack' => [199, 12],
        'looting_bag' => [995, 1000],
        'seed_box' => [5295, 40],
        'gem_bag' => [1623, 20],
        'chugging_barrel' => [2430, 15],
        'stash_units' => array_map(fn (int $identifier): array => [
            'id' => $identifier, 'name' => 'Lumbridge Swamp', 'tier' => 'Easy',
            'state' => 'filled', 'items' => [1095, 1], 'alternatives' => [],
        ], range(1, 200)),
    ]],
]);

it('preserves unchanged property timestamps while refreshing the online heartbeat', function (string $key, mixed $stored, mixed $posted): void {
    $this->freezeTime();
    $group = Group::create(['name' => 'heartbeat-group', 'hash' => 'heartbeat-token']);
    $member = Member::create(['group_id' => $group->id, 'name' => 'Alice']);
    $property = $member->properties()->create(['key' => $key, 'value' => $stored]);
    $this->travel(10)->seconds();

    $this->withHeader('Authorization', 'heartbeat-token')->postJson('/api/group/heartbeat-group/update-group-member', [
        'name' => $member->name, $key => $posted,
    ])->assertSuccessful();

    expect($property->fresh()->updated_at)->toEqual($property->updated_at);
    expect($member->fresh()->last_online_at)->toBe(now()->toDateTimeString());
})->with([
    'unchanged bank' => ['bank', [995, 100], [995, 100]],
    'reordered object keys' => ['interacting', ['id' => 1, 'name' => 'Goblin'], ['name' => 'Goblin', 'id' => 1]],
    'reordered nested object keys' => [
        'stash_units',
        [['id' => 28958, 'state' => 'filled', 'tier' => 'Easy', 'name' => 'Lumbridge Swamp', 'items' => [1095, 1], 'alternatives' => []]],
        [['id' => 28958, 'name' => 'Lumbridge Swamp', 'tier' => 'Easy', 'state' => 'filled', 'items' => [1095, 1], 'alternatives' => []]],
    ],
]);

it('updates the heartbeat when only the member name is posted', function (): void {
    $this->freezeTime();
    $group = Group::create(['name' => 'heartbeat-group', 'hash' => 'heartbeat-token']);
    $member = Member::create(['group_id' => $group->id, 'name' => 'Alice']);

    $this->withHeader('Authorization', 'heartbeat-token')->postJson('/api/group/heartbeat-group/update-group-member', [
        'name' => $member->name,
    ])->assertSuccessful();

    expect($member->fresh()->last_online_at)->toBe(now()->toDateTimeString());
});

it('persists changed list positions and JSON value types', function (array $stored, array $posted): void {
    $group = Group::create(['name' => 'changed-group', 'hash' => 'changed-token']);
    $member = Member::create(['group_id' => $group->id, 'name' => 'Alice']);
    $property = $member->properties()->create(['key' => 'bank', 'value' => $stored]);

    $this->withHeader('Authorization', 'changed-token')->postJson('/api/group/changed-group/update-group-member', [
        'name' => $member->name, 'bank' => $posted,
    ])->assertSuccessful();

    expect($property->fresh()->value)->toBe($posted);
})->with([
    'moved item' => [[995, 100, 4151, 1], [4151, 1, 995, 100]],
    'changed value types' => [['995', '100'], [995, 100]],
    'removed item' => [[995, 100, 4151, 1], [995, 100]],
]);

it('updates existing properties and inserts new properties in the same upload', function (): void {
    $group = Group::create(['name' => 'mixed-group', 'hash' => 'mixed-token']);
    $member = Member::create(['group_id' => $group->id, 'name' => 'Alice']);
    $bank = $member->properties()->create(['key' => 'bank', 'value' => [995, 100]]);

    $this->withHeader('Authorization', 'mixed-token')->postJson('/api/group/mixed-group/update-group-member', [
        'name' => $member->name, 'bank' => [995, 75], 'herb_sack' => [199, 10],
    ])->assertSuccessful();

    expect($bank->fresh()->value)->toBe([995, 75]);
    expect($member->properties()->where('key', '=', 'herb_sack')->sole()->value)->toBe([199, 10]);
});

it('updates existing properties while another transaction locks the insertion gap', function (): void {
    config([
        'database.default' => 'mysql',
        'database.connections.mysql.database' => 'gim_hub_test',
    ]);
    RefreshDatabaseState::$migrated = false;
    $this->refreshDatabase();

    $group = Group::create(['name' => 'locking-group', 'hash' => 'locking-token']);
    $member = Member::create(['group_id' => $group->id, 'name' => 'Alice']);
    $member->properties()->createMany([
        ['key' => 'bank', 'value' => [995, 100]],
        ['key' => 'herb_sack', 'value' => [199, 5]],
    ]);
    $otherMember = Member::create(['group_id' => $group->id, 'name' => 'Bob']);
    $otherMember->properties()->create(['key' => 'bank', 'value' => [995, 200]]);
    DB::commit();
    Exceptions::fake();
    DB::statement('set session innodb_lock_wait_timeout = 1');
    $blockingConnection = DB::build(config('database.connections.'.config('database.default')));
    $blockingConnection->beginTransaction();

    try {
        $blockingConnection->table('member_properties')->orderByDesc('id')->limit(1)->lockForUpdate()->get();

        $this->withHeader('Authorization', 'locking-token')->postJson('/api/group/locking-group/update-group-member', [
            'name' => $member->name, 'bank' => [995, 75], 'herb_sack' => [199, 10],
        ])->assertSuccessful();

        expect($member->properties()->where('key', '=', 'bank')->sole()->value)->toBe([995, 75]);
        expect($member->properties()->where('key', '=', 'herb_sack')->sole()->value)->toBe([199, 10]);
        expect($otherMember->properties()->sole()->value)->toBe([995, 200]);
        Exceptions::assertNothingReported();
    } finally {
        $blockingConnection->rollBack();
        $blockingConnection->disconnect();
    }
});
