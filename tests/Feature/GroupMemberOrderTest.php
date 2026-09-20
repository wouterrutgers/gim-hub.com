<?php

it('saves member order for subsequent group data requests and appends new members', function (): void {
    $token = $this->postJson('/api/create-group', [
        'name' => 'ordered-group',
        'member_names' => ['Charlie', 'Alice', 'Bob'],
    ])->assertCreated()->json('token');

    $initialNames = collect($this->withHeader('Authorization', $token)
        ->getJson('/api/group/ordered-group/get-group-data?from_time=2000-01-01')
        ->assertOk()
        ->json())
        ->pluck('name')
        ->reject(fn (string $name): bool => $name === '@SHARED')
        ->values()
        ->all();

    expect($initialNames)->toBe(['Charlie', 'Alice', 'Bob']);

    $this->withHeader('Authorization', $token)
        ->putJson('/api/group/ordered-group/reorder-group-members', [
            'member_names' => ['Bob', 'Charlie', 'Alice'],
        ])->assertOk();

    $this->withHeader('Authorization', $token)
        ->postJson('/api/group/ordered-group/add-group-member', ['name' => 'Dave'])
        ->assertCreated();

    $names = collect($this->withHeader('Authorization', $token)
        ->getJson('/api/group/ordered-group/get-group-data?from_time=2000-01-01')
        ->assertOk()
        ->json())
        ->pluck('name')
        ->reject(fn (string $name): bool => $name === '@SHARED')
        ->values()
        ->all();

    expect($names)->toBe(['Bob', 'Charlie', 'Alice', 'Dave']);
});

it('rejects a member order that does not match the authenticated group', function (): void {
    $token = $this->postJson('/api/create-group', [
        'name' => 'order-validation-group',
        'member_names' => ['Alice', 'Bob'],
    ])->assertCreated()->json('token');

    $this->withHeader('Authorization', $token)
        ->putJson('/api/group/order-validation-group/reorder-group-members', [
            'member_names' => ['Alice', 'Mallory'],
        ])->assertBadRequest();

    $names = collect($this->withHeader('Authorization', $token)
        ->getJson('/api/group/order-validation-group/get-group-data?from_time=2000-01-01')
        ->assertOk()
        ->json())
        ->pluck('name')
        ->reject(fn (string $name): bool => $name === '@SHARED')
        ->values()
        ->all();

    expect($names)->toBe(['Alice', 'Bob']);
});
