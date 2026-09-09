<?php

use App\Models\Group;
use App\Models\Member;

function storageMember(): Member
{
    $group = Group::create(['name' => 'storage-group', 'hash' => 'storage-token']);

    return Member::create(['group_id' => $group->id, 'name' => 'Alice']);
}

function stashUnit(int $identifier, string $state = 'filled', array $items = [1095, 1]): array
{
    return ['id' => $identifier, 'name' => 'Lumbridge Swamp', 'tier' => 'Easy', 'state' => $state, 'items' => $items, 'alternatives' => []];
}

it('stores and retrieves portable contents, preserves omitted data and clears confirmed empty containers', function (string $key, array $items): void {
    $member = storageMember();
    $this->withHeader('Authorization', 'storage-token')->postJson('/api/group/storage-group/update-group-member', ['name' => 'Alice', $key => $items])->assertSuccessful();
    $this->postJson('/api/group/storage-group/update-group-member', ['name' => 'Alice'])->assertSuccessful();
    $this->postJson('/api/group/storage-group/update-group-member', ['name' => 'Alice', $key => null])->assertSuccessful();

    expect($member->load('properties')->getProperty($key)->value)->toBe($items);
    $this->getJson('/api/group/storage-group/get-group-data?from_time=2000-01-01')->assertJsonPath("0.{$key}", $items);

    $this->postJson('/api/group/storage-group/update-group-member', ['name' => 'Alice', $key => []])->assertSuccessful();
    expect($member->fresh()->load('properties')->getProperty($key)->value)->toBe([]);
    $this->getJson('/api/group/storage-group/get-group-data?from_time=2000-01-01')->assertJsonPath("0.{$key}", []);
})->with([
    'herb sack' => ['herb_sack', [199, 12, 209, 4]],
    'looting bag' => ['looting_bag', [995, 1000, 4151, 1]],
    'seed box' => ['seed_box', [5295, 40]],
    'gem bag' => ['gem_bag', [1623, 20]],
    'chugging barrel' => ['chugging_barrel', [2430, 15]],
]);

it('reconciles individual STASH records without erasing unobserved units or duplicating repeated snapshots', function (): void {
    $member = storageMember();
    $units = [stashUnit(28958), stashUnit(28959), stashUnit(34736, 'unbuilt', [])];
    $this->withHeader('Authorization', 'storage-token')->postJson('/api/group/storage-group/update-group-member', ['name' => 'Alice', 'stash_units' => $units])->assertSuccessful();
    $this->postJson('/api/group/storage-group/update-group-member', ['name' => 'Alice', 'stash_units' => $units])->assertSuccessful();
    $this->postJson('/api/group/storage-group/update-group-member', ['name' => 'Alice', 'stash_units' => [stashUnit(28958, 'empty', [])]])->assertSuccessful();
    $this->postJson('/api/group/storage-group/update-group-member', ['name' => 'Alice'])->assertSuccessful();

    $expected = [stashUnit(28958, 'empty', []), stashUnit(28959), stashUnit(34736, 'unbuilt', [])];
    expect($member->load('properties')->getProperty('stash_units')->value)->toBe($expected);
    $this->getJson('/api/group/storage-group/get-group-data?from_time=2000-01-01')->assertJsonPath('0.stash_units', $expected);

    $this->postJson('/api/group/storage-group/update-group-member', ['name' => 'Alice', 'stash_units' => null])->assertSuccessful();
    expect($member->fresh()->load('properties')->getProperty('stash_units')->value)->toBe($expected);
});

it('retains unresolved alternatives without inventing items', function (): void {
    $member = storageMember();
    $unit = [...stashUnit(29019, items: []), 'alternatives' => ['Any stole', 'Any heraldic rune shield']];
    $this->withHeader('Authorization', 'storage-token')->postJson('/api/group/storage-group/update-group-member', ['name' => 'Alice', 'stash_units' => [$unit]])->assertSuccessful();

    expect($member->load('properties')->getProperty('stash_units')->value)->toBe([$unit]);
});

it('rejects malformed storage snapshots without replacing saved contents', function (array $payload, string $attribute): void {
    $member = storageMember();
    $member->properties()->create(['key' => 'herb_sack', 'value' => [199, 5]]);
    $this->withHeader('Authorization', 'storage-token')->postJson('/api/group/storage-group/update-group-member', ['name' => 'Alice', ...$payload])->assertUnprocessable()->assertJsonValidationErrors($attribute);

    expect($member->load('properties')->getProperty('herb_sack')->value)->toBe([199, 5]);
    expect($member->getProperty('stash_units'))->toBeNull();
})->with([
    'odd pairs' => [['herb_sack' => [199]], 'herb_sack'],
    'negative count' => [['herb_sack' => [199, -1]], 'herb_sack'],
    'non-array contents' => [['herb_sack' => 199], 'herb_sack'],
    'keyed contents' => [['herb_sack' => [199 => 5]], 'herb_sack'],
    'string quantity' => [['herb_sack' => [199, '5']], 'herb_sack'],
    'overflowing quantity' => [['herb_sack' => [199, 2147483648]], 'herb_sack'],
    'non-array units' => [['stash_units' => 28958], 'stash_units'],
    'non-array unit' => [['stash_units' => [28958]], 'stash_units.0'],
    'non-array unit contents' => [['stash_units' => [[...stashUnit(28958), 'items' => 1095]]], 'stash_units.0.items'],
    'odd unit pairs' => [['stash_units' => [stashUnit(28958, items: [1095])]], 'stash_units.0.items'],
    'duplicate units' => [['stash_units' => [stashUnit(28958), stashUnit(28958)]], 'stash_units.0.id'],
    'unreadable state' => [['stash_units' => [stashUnit(28958, 'unknown')]], 'stash_units.0.state'],
    'missing contents' => [['stash_units' => [array_diff_key(stashUnit(28958), ['items' => true])]], 'stash_units.0.items'],
]);

it('isolates storage updates by group and member', function (): void {
    $member = storageMember();
    $otherGroup = Group::create(['name' => 'other-storage', 'hash' => 'other-token']);
    $otherMember = Member::create(['group_id' => $otherGroup->id, 'name' => 'Alice']);
    $this->withHeader('Authorization', 'storage-token')->postJson('/api/group/other-storage/update-group-member', ['name' => 'Alice', 'herb_sack' => [199, 10]])->assertUnauthorized();
    $this->postJson('/api/group/storage-group/update-group-member', ['name' => 'Bob', 'herb_sack' => [199, 10]])->assertUnauthorized();
    $this->postJson('/api/group/storage-group/update-group-member', ['name' => 'Alice', 'herb_sack' => [199, 10]])->assertSuccessful();

    expect($otherMember->properties()->count())->toBe(0);
    expect($member->load('properties')->getProperty('herb_sack')->value)->toBe([199, 10]);
});
