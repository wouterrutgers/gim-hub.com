<?php

it('creates an underscore group with a valid zero name and requires its token to load data', function (): void {
    $token = $this->postJson('/api/create-group', [
        'name' => '_',
        'member_names' => ['0', 'Alice'],
    ])->assertCreated()->json('token');

    $this->getJson('/api/group/_/am-i-logged-in')->assertBadRequest();
    $this->withHeader('Authorization', 'wrong-token')->getJson('/api/group/_/am-i-logged-in')->assertUnauthorized();
    $this->withHeader('Authorization', $token)
        ->getJson('/api/group/_/get-group-data?from_time=2000-01-01')
        ->assertOk()->assertJsonCount(3)->assertJsonPath('1.name', '0')->assertJsonPath('2.name', 'Alice');
});

it('rejects invalid rosters before creating a group or its members', function (array $memberNames): void {
    $this->postJson('/api/create-group', ['name' => 'invalid-roster', 'member_names' => $memberNames])->assertUnprocessable();

    $this->assertDatabaseCount('groups', 0);
    $this->assertDatabaseCount('members', 0);
})->with([
    'too few players' => [['Alice']],
    'too many players' => [['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank']],
    'duplicate players' => [['Alice', 'alice']],
    'invalid player type' => [[['name' => 'Alice'], 'Bob']],
]);
