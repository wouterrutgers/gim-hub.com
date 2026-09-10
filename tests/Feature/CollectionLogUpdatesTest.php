<?php

use App\Models\Group;
use App\Models\Member;

function collectionUpdate(string $type, array $items): array
{
    return ['type' => $type, 'items' => collect($items)->map(function (int $quantity, int $identifier): array {
        return ['item_id' => $identifier, 'quantity' => $quantity];
    })->values()->all()];
}

function collectionMember(): Member
{
    $group = Group::create(['name' => 'collection-group', 'hash' => 'collection-token']);

    return Member::create(['group_id' => $group->id, 'name' => 'Alice']);
}

it('increments existing collection items and discovers missing items while excluding ordinary loot', function (): void {
    $member = collectionMember();
    $member->collectionLogs()->create(['item_id' => 6739, 'item_count' => 2]);

    $this->withHeader('Authorization', 'collection-token')->postJson('/api/group/collection-group/update-group-member', [
        'name' => $member->name,
        'collection_log_updates' => [collectionUpdate('drop', [6739 => 1, 4151 => 2, 995 => 100])],
    ])->assertSuccessful();

    $this->getJson('/api/group/collection-group/collection-log')->assertJsonPath('Alice.6739', 3)->assertJsonPath('Alice.4151', 2)->assertJsonMissingPath('Alice.995');
});

it('increments each separately reported drop', function (): void {
    $member = collectionMember();
    $update = collectionUpdate('drop', [6739 => 1]);
    $this->withHeader('Authorization', 'collection-token')->postJson('/api/group/collection-group/update-group-member', ['name' => $member->name, 'collection_log_updates' => [$update]])->assertSuccessful();
    $this->postJson('/api/group/collection-group/update-group-member', ['name' => $member->name, 'collection_log_updates' => [collectionUpdate('drop', [6739 => 1])]])->assertSuccessful();

    expect($member->collectionLogs()->sole()->item_count)->toBe(2);
});

it('reconciles authoritative scans before subsequent drops', function (): void {
    $member = collectionMember();
    $updates = [collectionUpdate('drop', [6739 => 1]), collectionUpdate('scan', [6739 => 7]), collectionUpdate('drop', [6739 => 2])];
    $this->withHeader('Authorization', 'collection-token')->postJson('/api/group/collection-group/update-group-member', ['name' => $member->name, 'collection_log_updates' => $updates])->assertSuccessful();
    $this->postJson('/api/group/collection-group/update-group-member', ['name' => $member->name, 'collection_log_updates' => [collectionUpdate('drop', [6739 => 1])]])->assertSuccessful();

    expect($member->collectionLogs()->sole()->item_count)->toBe(10);
});

it('does not reduce existing counts when an unlock is reported', function (): void {
    $member = collectionMember();
    $member->collectionLogs()->create(['item_id' => 6739, 'item_count' => 3]);
    $this->withHeader('Authorization', 'collection-token')->postJson('/api/group/collection-group/update-group-member', [
        'name' => $member->name, 'collection_log_updates' => [collectionUpdate('unlock', [6739 => 1, 4151 => 1])],
    ])->assertSuccessful();

    expect($member->collectionLogs()->pluck('item_count', 'item_id')->all())->toBe([6739 => 3, 4151 => 1]);
});

it('increments the canonical count when an older scan stored an alias', function (): void {
    $member = collectionMember();
    $member->collectionLogs()->create(['item_id' => 25629, 'item_count' => 2]);
    $this->withHeader('Authorization', 'collection-token')->postJson('/api/group/collection-group/update-group-member', [
        'name' => $member->name, 'collection_log_updates' => [collectionUpdate('drop', [24882 => 1])],
    ])->assertSuccessful();

    expect($member->collectionLogs()->sole()->only('item_id', 'item_count'))->toBe(['item_id' => 24882, 'item_count' => 3]);
});

it('accepts a scan correcting a count to zero', function (): void {
    $member = collectionMember();
    $member->collectionLogs()->create(['item_id' => 6739, 'item_count' => 2]);
    $this->withHeader('Authorization', 'collection-token')->postJson('/api/group/collection-group/update-group-member', [
        'name' => $member->name, 'collection_log_updates' => [collectionUpdate('scan', [6739 => 0])],
    ])->assertSuccessful();

    expect($member->collectionLogs()->sole()->item_count)->toBe(0);
});

it('processes a full collection scan with subsequent drops', function (): void {
    $member = collectionMember();
    $aliases = json_decode(file_get_contents(resource_path('game/collection-log-item-aliases.json')), associative: true, flags: JSON_THROW_ON_ERROR);
    $items = collect(json_decode(file_get_contents(resource_path('assets/data/collection_log_info.json')), associative: true, flags: JSON_THROW_ON_ERROR))
        ->pluck('pages')->flatten(1)->pluck('items')->flatten(1)->pluck('id')
        ->diff(array_keys($aliases))->unique()->mapWithKeys(fn (int $identifier): array => [$identifier => 2])->all();

    $this->withHeader('Authorization', 'collection-token')->postJson('/api/group/collection-group/update-group-member', [
        'name' => $member->name,
        'collection_log_updates' => [collectionUpdate('scan', $items), collectionUpdate('drop', [6739 => 1])],
    ])->assertSuccessful();

    expect($member->collectionLogs()->count())->toBe(count($items));
    expect($member->collectionLogs()->where('item_id', '=', 6739)->sole()->item_count)->toBe(3);
    expect($member->collectionLogs()->where('item_id', '=', 4151)->sole()->item_count)->toBe(2);
});

it('does not allow a different group to update a member', function (): void {
    $member = collectionMember();
    Group::create(['name' => 'other-group', 'hash' => 'other-token']);
    $this->withHeader('Authorization', 'other-token')->postJson('/api/group/other-group/update-group-member', ['name' => $member->name, 'collection_log_updates' => [collectionUpdate('drop', [6739 => 1])]])->assertUnauthorized();

    expect($member->collectionLogs()->count())->toBe(0);
});

it('requires a valid group token for collection increments', function (): void {
    $member = collectionMember();
    $this->withHeader('Authorization', 'wrong-token')->postJson('/api/group/collection-group/update-group-member', ['name' => $member->name, 'collection_log_updates' => [collectionUpdate('drop', [6739 => 1])]])->assertUnauthorized();

    expect($member->collectionLogs()->count())->toBe(0);
});

it('continues accepting legacy absolute collection counts', function (): void {
    $member = collectionMember();
    $this->withHeader('Authorization', 'collection-token')->postJson('/api/group/collection-group/update-group-member', ['name' => $member->name, 'collection_log_v2' => [6739, 4]])->assertSuccessful();

    expect($member->collectionLogs()->sole()->item_count)->toBe(4);
});

it('keeps the obtained count when a scan includes both an item and an unobtained alias', function (): void {
    $member = collectionMember();
    $this->withHeader('Authorization', 'collection-token')->postJson('/api/group/collection-group/update-group-member', [
        'name' => $member->name, 'collection_log_updates' => [collectionUpdate('scan', [24882 => 3, 25629 => 0])],
    ])->assertSuccessful();

    expect($member->collectionLogs()->sole()->only('item_id', 'item_count'))->toBe(['item_id' => 24882, 'item_count' => 3]);
});

it('requires quantities and rejects mixed legacy and ordered collection uploads', function (): void {
    $member = collectionMember();
    $update = collectionUpdate('drop', [6739 => 1]);
    unset($update['items'][0]['quantity']);
    $this->withHeader('Authorization', 'collection-token')->postJson('/api/group/collection-group/update-group-member', [
        'name' => $member->name, 'collection_log_updates' => [$update], 'collection_log_v2' => [6739, 5],
    ])->assertUnprocessable()->assertJsonValidationErrors(['collection_log_updates', 'collection_log_updates.0.items.0.quantity']);

    expect($member->collectionLogs()->count())->toBe(0);
});

it('returns 422 for invalid quantities without applying earlier collection updates', function (string $type, mixed $quantity): void {
    $member = collectionMember();
    $member->collectionLogs()->create(['item_id' => 6739, 'item_count' => 2]);

    $this->withHeader('Authorization', 'collection-token')->postJson('/api/group/collection-group/update-group-member', [
        'name' => $member->name,
        'collection_log_updates' => [
            collectionUpdate('scan', [6739 => 0]),
            ['type' => $type, 'items' => [['item_id' => 6739, 'quantity' => $quantity]]],
        ],
    ])->assertUnprocessable()->assertJsonValidationErrors('collection_log_updates.1.items.0.quantity');

    expect($member->collectionLogs()->sole()->item_count)->toBe(2);
})->with([
    'zero drop' => ['drop', 0],
    'zero unlock' => ['unlock', 0],
    'negative scan' => ['scan', -1],
    'fractional quantity' => ['drop', 1.5],
    'nonnumeric quantity' => ['drop', 'invalid'],
    'null quantity' => ['scan', null],
    'overflow quantity' => ['scan', 2147483648],
]);
