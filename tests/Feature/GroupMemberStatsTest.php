<?php

use App\Models\Group;
use App\Models\Member;

it('rejects invalid stats lengths without changing saved stats', function (array $stats): void {
    $group = Group::create([
        'name' => 'invalid-special-attack',
        'hash' => 'invalid-special-attack-token',
    ]);
    $member = Member::create([
        'group_id' => $group->id,
        'name' => 'Alice',
    ]);
    $savedStats = [90, 99, 80, 85, 7000, 100, 301, 75];
    $member->properties()->create(['key' => 'stats', 'value' => $savedStats]);

    $this->withHeader('Authorization', $group->hash)
        ->postJson("/api/group/{$group->name}/update-group-member", [
            'name' => $member->name,
            'stats' => $stats,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('stats');

    expect($member->load('properties')->getProperty('stats')->value)->toBe($savedStats);
})->with([
    'missing special attack' => [[90, 99, 80, 85, 7000, 100, 301]],
    'additional stat' => [[90, 99, 80, 85, 7000, 100, 301, 75, 1]],
]);
