<?php

use Carbon\CarbonImmutable;

it('returns scoped range samples with an exact preceding baseline and all skills', function (): void {
    $this->travelTo(CarbonImmutable::parse('2026-09-07 13:00:00'));
    $group = $this->createSnapshotGroup();
    $member = $this->createCompleteSnapshotMember($group);
    $otherMember = $this->createCompleteSnapshotMember($this->createSnapshotGroup('other'));
    $skills = [...range(0, 22), 4294967295];
    foreach (['11:00:00', '12:00:00', '12:05:00', '12:10:00', '12:15:00'] as $time) {
        $member->skillStats()->create(['type' => 'five_minutes', 'skills' => $skills, 'created_at' => "2026-09-07 {$time}"]);
    }
    $otherMember->skillStats()->create(['type' => 'five_minutes', 'skills' => array_fill(0, 24, 999), 'created_at' => '2020-01-01']);

    $this->withHeader('Authorization', $group->hash)
        ->getJson("/api/group/{$group->name}/get-skill-data?start=2026-09-07T12:02:00Z&end=2026-09-07T12:10:00Z")
        ->assertOk()
        ->assertJsonCount(1, 'members')
        ->assertJsonPath('earliest', '2026-09-07T11:00:00Z')
        ->assertJsonPath('members.0.name', $member->name)
        ->assertJsonPath('members.0.skill_data', [
            ['time' => '2026-09-07T12:00:00Z', 'data' => $skills],
            ['time' => '2026-09-07T12:05:00Z', 'data' => $skills],
            ['time' => '2026-09-07T12:10:00Z', 'data' => $skills],
        ]);
});

it('merges older tiers without letting coarse bucket totals overwrite finer observations', function (): void {
    $this->travelTo(CarbonImmutable::parse('2026-09-07 13:00:00'));
    $group = $this->createSnapshotGroup();
    $member = $this->createCompleteSnapshotMember($group);
    foreach ([
        ['monthly', '2024-01-01', 1],
        ['monthly', '2025-01-01', 10],
        ['daily', '2025-01-02', 20],
        ['daily', '2025-01-03', 999],
        ['hourly', '2025-01-03 11:00', 30],
        ['hourly', '2026-09-07 12:00', 999],
        ['five_minutes', '2026-09-07 12:05', 40],
        ['five_minutes', '2026-09-07 12:10', 50],
    ] as [$type, $time, $experience]) {
        $member->skillStats()->create(['type' => $type, 'skills' => array_fill(0, 24, $experience), 'created_at' => $time]);
    }

    $response = $this->withHeader('Authorization', $group->hash)
        ->getJson("/api/group/{$group->name}/get-skill-data?end=2026-09-07T13:00:00Z")
        ->assertOk()
        ->assertJsonPath('start', '2024-01-01T00:00:00Z');

    expect(array_column(array_column($response->json('members.0.skill_data'), 'data'), 0))->toBe([1, 20, 30, 50]);
});

it('bounds display samples while retaining the first observation baseline and final value', function (): void {
    $this->travelTo(CarbonImmutable::parse('2026-09-07 12:00:00'));
    $group = $this->createSnapshotGroup();
    $member = $this->createCompleteSnapshotMember($group);
    for ($index = 0; $index <= 1800; $index++) {
        $member->skillStats()->create([
            'type' => 'five_minutes',
            'skills' => array_fill(0, 24, $index),
            'created_at' => now()->subMinutes((1800 - $index) * 5),
        ]);
    }

    $response = $this->withHeader('Authorization', $group->hash)
        ->getJson("/api/group/{$group->name}/get-skill-data?end=2026-09-07T12:00:00Z")
        ->assertOk();

    expect(count($response->json('members.0.skill_data')))->toBeLessThanOrEqual(1502);
    expect($response->json('members.0.skill_data.0.data.0'))->toBe(0);
    expect($response->json('members.0.skill_data.1.data.0'))->toBe(1);
    expect(collect($response->json('members.0.skill_data'))->last()['data'][0])->toBe(1800);
});

it('returns empty history without inventing observations', function (): void {
    $group = $this->createSnapshotGroup();
    $this->createCompleteSnapshotMember($group);

    $this->withHeader('Authorization', $group->hash)
        ->getJson("/api/group/{$group->name}/get-skill-data?end=2026-01-01T00:00:00Z")
        ->assertOk()
        ->assertJsonPath('earliest', null)
        ->assertJsonPath('members.0.skill_data', []);
});

it('rejects invalid date ranges', function (string $query, string $field): void {
    $group = $this->createSnapshotGroup();

    $this->withHeader('Authorization', $group->hash)
        ->getJson("/api/group/{$group->name}/get-skill-data?{$query}")
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);
})->with([
    ['period=Day', 'end'],
    ['start=invalid&end=2026-01-01', 'start'],
    ['start=2026-02-01&end=2026-01-01', 'start'],
    ['start=2026-01-01&end=2026-01-01', 'start'],
    ['end=invalid', 'end'],
    ['end=2999-01-01', 'end'],
]);

it('rejects another groups token', function (): void {
    $group = $this->createSnapshotGroup();
    $otherGroup = $this->createSnapshotGroup('other');

    $this->withHeader('Authorization', $otherGroup->hash)
        ->getJson("/api/group/{$group->name}/get-skill-data?end=2026-01-01")
        ->assertUnauthorized();
});
