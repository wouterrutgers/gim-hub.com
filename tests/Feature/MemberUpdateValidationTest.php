<?php

use App\Models\Group;
use App\Models\Member;

function validationMember(): Member
{
    $group = Group::create(['name' => 'validation-group', 'hash' => 'validation-token']);

    return Member::create(['group_id' => $group->id, 'name' => 'Alice']);
}

it('returns 422 for invalid storage arrays without applying other storage updates', function (array $payload, string $attribute): void {
    $member = validationMember();
    $member->properties()->create(['key' => 'bank', 'value' => [995, 100]]);

    $this->withHeader('Authorization', 'validation-token')
        ->postJson('/api/group/validation-group/update-group-member', ['name' => 'Alice', 'herb_sack' => [199, 8], ...$payload])
        ->assertUnprocessable()
        ->assertJsonValidationErrors($attribute);

    expect($member->load('properties')->getProperty('bank')->value)->toBe([995, 100]);
    expect($member->getProperty('herb_sack'))->toBeNull();
})->with([
    'short inventory' => [['inventory' => array_fill(0, 55, 0)], 'inventory'],
    'long inventory' => [['inventory' => array_fill(0, 57, 0)], 'inventory'],
    'empty fixed inventory' => [['inventory' => []], 'inventory'],
    'oversized bank' => [['bank' => array_fill(0, 3001, 0)], 'bank'],
    'non-array bank' => [['bank' => 995], 'bank'],
    'three rune pouch slots' => [['rune_pouch' => array_fill(0, 6, 0)], 'rune_pouch'],
    'incomplete rune pouch slot' => [['rune_pouch' => array_fill(0, 7, 0)], 'rune_pouch'],
    'oversized rune pouch' => [['rune_pouch' => array_fill(0, 9, 0)], 'rune_pouch'],
]);

it('reports inventory and portable storage validation errors together without updating the member', function (): void {
    $member = validationMember();
    $member->properties()->create(['key' => 'bank', 'value' => [995, 100]]);

    $this->withHeader('Authorization', 'validation-token')
        ->postJson('/api/group/validation-group/update-group-member', [
            'name' => 'Alice',
            'inventory' => array_fill(0, 55, 0),
            'herb_sack' => [199],
            'bank' => [],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['inventory', 'herb_sack']);

    expect($member->load('properties')->getProperty('bank')->value)->toBe([995, 100]);
});

it('preserves bank contents for omitted or null snapshots and clears an explicit empty snapshot', function (): void {
    $member = validationMember();
    $member->properties()->create(['key' => 'bank', 'value' => [995, 100]]);

    $this->withHeader('Authorization', 'validation-token')->postJson('/api/group/validation-group/update-group-member', ['name' => 'Alice'])->assertSuccessful();
    $this->postJson('/api/group/validation-group/update-group-member', ['name' => 'Alice', 'bank' => null])->assertSuccessful();

    expect($member->load('properties')->getProperty('bank')->value)->toBe([995, 100]);

    $this->postJson('/api/group/validation-group/update-group-member', ['name' => 'Alice', 'bank' => []])->assertSuccessful();

    expect($member->fresh()->load('properties')->getProperty('bank')->value)->toBe([]);
});

it('applies negative bank deltas', function (): void {
    $member = validationMember();
    $member->properties()->create(['key' => 'bank', 'value' => [995, 100]]);

    $this->withHeader('Authorization', 'validation-token')
        ->postJson('/api/group/validation-group/update-group-member', ['name' => 'Alice', 'bank_partial' => [995, -25]])
        ->assertSuccessful();

    expect($member->load('properties')->getProperty('bank')->value)->toBe([995, 75]);
});
