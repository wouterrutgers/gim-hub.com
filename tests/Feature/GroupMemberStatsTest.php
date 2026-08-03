<?php

use App\Models\Group;
use App\Models\Member;
use Illuminate\Support\Facades\Exceptions;

it('stores supported member stats payloads', function (array $stats) {
    $group = Group::create([
        'name' => 'special-attack',
        'hash' => 'special-attack-token',
    ]);
    $member = Member::create([
        'group_id' => $group->id,
        'name' => 'Alice',
    ]);
    $this->withHeader('Authorization', $group->hash)
        ->postJson("/api/group/{$group->name}/update-group-member", [
            'name' => $member->name,
            'stats' => $stats,
        ])
        ->assertSuccessful();

    expect($member->load('properties')->getProperty('stats')->value)->toBe($stats);
})->with([
    'without special attack' => [[90, 99, 80, 85, 7000, 100, 301]],
    'with special attack' => [[90, 99, 80, 85, 7000, 100, 301, 75]],
]);

it('requires between seven and eight member stats', function (array $stats) {
    Exceptions::fake(Exception::class);

    $group = Group::create([
        'name' => 'invalid-special-attack',
        'hash' => 'invalid-special-attack-token',
    ]);
    $member = Member::create([
        'group_id' => $group->id,
        'name' => 'Alice',
    ]);

    $this->withHeader('Authorization', $group->hash)
        ->postJson("/api/group/{$group->name}/update-group-member", [
            'name' => $member->name,
            'stats' => $stats,
        ])
        ->assertServerError();

    Exceptions::assertReported(
        fn (Exception $exception): bool => $exception->getMessage() === 'stats length must be between 7 and 8'
    );
})->with([
    'too few stats' => [[90, 99, 80, 85, 7000, 100]],
    'additional stat' => [[90, 99, 80, 85, 7000, 100, 301, 75, 1]],
]);
