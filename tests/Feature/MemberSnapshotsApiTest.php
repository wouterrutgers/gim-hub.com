<?php

use App\Models\Member;
use App\Models\MemberSnapshot;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Http;

it('returns scoped weekly and marker baselines for each member', function () {
    $group = $this->createSnapshotGroup();
    $member = $this->createCompleteSnapshotMember($group);
    $otherGroupMember = $this->createCompleteSnapshotMember($this->createSnapshotGroup('other-group'));

    $firstCreatedAt = CarbonImmutable::now()->subHours(4)->startOfMinute();
    $secondCreatedAt = $firstCreatedAt->addHour();
    $thirdCreatedAt = $firstCreatedAt->addHours(2);
    $fourthCreatedAt = $firstCreatedAt->addHours(3);

    foreach ([$firstCreatedAt, $secondCreatedAt, $thirdCreatedAt, $fourthCreatedAt] as $index => $createdAt) {
        $member->snapshots()->create([
            'snapshot' => $this->snapshotPayload($createdAt->getTimestamp() * 1000, 100 + $index),
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
        ]);
    }

    $otherGroupMember->snapshots()->create([
        'snapshot' => $this->snapshotPayload($firstCreatedAt->subDay()->getTimestamp() * 1000, 999),
        'created_at' => $firstCreatedAt->subDay(),
        'updated_at' => $firstCreatedAt->subDay(),
    ]);

    $markers = array_fill_keys([
        'Deleted 1',
        'Deleted 2',
        'Deleted 3',
        'Deleted 4',
        'Deleted 5',
    ], $firstCreatedAt->getTimestamp() * 1000);
    $markers[$member->name] = $thirdCreatedAt->getTimestamp() * 1000;
    $query = http_build_query(['markers' => $markers]);

    $response = $this->withHeader('Authorization', $group->hash)
        ->getJson("/api/group/{$group->name}/snapshots?{$query}");

    $response->assertSuccessful()
        ->assertJsonCount(1)
        ->assertJsonCount(2, $member->name)
        ->assertJsonPath("{$member->name}.lastWeek.timestamp", $firstCreatedAt->getTimestamp() * 1000)
        ->assertJsonPath("{$member->name}.lastVisit.timestamp", $thirdCreatedAt->getTimestamp() * 1000)
        ->assertJsonPath("{$member->name}.lastVisit.skills.Attack", 102);

    $this->withHeader('Authorization', $group->hash)
        ->getJson("/api/group/{$group->name}/snapshots")
        ->assertSuccessful()
        ->assertJsonPath("{$member->name}.lastVisit.timestamp", $firstCreatedAt->getTimestamp() * 1000)
        ->assertJsonPath("{$member->name}.lastWeek.timestamp", $firstCreatedAt->getTimestamp() * 1000);

    $query = http_build_query([
        'markers' => [
            $member->name => $firstCreatedAt->subSecond()->getTimestamp() * 1000,
        ],
    ]);

    $this->withHeader('Authorization', $group->hash)
        ->getJson("/api/group/{$group->name}/snapshots?{$query}")
        ->assertSuccessful()
        ->assertJsonPath("{$member->name}.lastVisit.timestamp", $firstCreatedAt->getTimestamp() * 1000)
        ->assertJsonPath("{$member->name}.lastWeek.timestamp", $firstCreatedAt->getTimestamp() * 1000);
});

it('creates an exact clear baseline for a group member', function () {
    Http::fake([
        '*' => Http::response($this->snapshotHiscoresResponse(
            skillExperience: ['Attack' => 500],
            activities: [['name' => 'Abyssal Sire', 'score' => 42]],
        )),
    ]);

    $group = $this->createSnapshotGroup();
    $member = $this->createCompleteSnapshotMember($group);

    $response = $this->withHeader('Authorization', $group->hash)
        ->postJson("/api/group/{$group->name}/snapshots", [
            'name' => $member->name,
        ]);

    $response->assertCreated()
        ->assertJsonPath('skills.Attack', 500)
        ->assertJsonPath('bossKc.Abyssal Sire', 42)
        ->assertJsonStructure([
            'timestamp',
            'skills',
            'quests',
            'diaries',
            'collection',
            'bossKc',
        ]);

    $snapshot = MemberSnapshot::where('member_id', '=', $member->id)->sole();
    $this->assertModelExists($snapshot);
    expect($response->json())->toBe($snapshot->snapshot);
});

it('does not create a clear baseline for a member outside the group', function () {
    $group = $this->createSnapshotGroup();
    $otherMember = $this->createCompleteSnapshotMember($this->createSnapshotGroup('other-group'));

    $this->withHeader('Authorization', $group->hash)
        ->postJson("/api/group/{$group->name}/snapshots", [
            'name' => $otherMember->name,
        ])
        ->assertNotFound();

    expect(MemberSnapshot::query()->count())->toBe(0);
    Http::assertNothingSent();
});

it('returns snapshot baselines as an object for a numeric member name', function () {
    $group = $this->createSnapshotGroup();
    $member = $this->createCompleteSnapshotMember($group, '0');
    $timestamp = now()->getTimestampMs();

    $member->snapshots()->create([
        'snapshot' => $this->snapshotPayload($timestamp),
    ]);

    $response = $this->withHeader('Authorization', $group->hash)
        ->getJson("/api/group/{$group->name}/snapshots?markers[0]={$timestamp}");

    $response->assertSuccessful()
        ->assertJsonPath('0.lastVisit.timestamp', $timestamp)
        ->assertJsonPath('0.lastWeek.timestamp', $timestamp);

    expect(json_decode($response->getContent(), flags: JSON_THROW_ON_ERROR))->toBeObject();
});

it('creates a clear baseline from partially updated member data', function () {
    Http::fake([
        '*' => Http::response([], 404),
    ]);

    $group = $this->createSnapshotGroup();
    $member = Member::create([
        'group_id' => $group->id,
        'name' => 'Alice',
    ]);
    $member->properties()->create([
        'key' => 'skills',
        'value' => array_fill(0, 24, 100),
    ]);

    $this->withHeader('Authorization', $group->hash)
        ->postJson("/api/group/{$group->name}/snapshots", [
            'name' => $member->name,
        ])
        ->assertCreated()
        ->assertJsonPath('skills.Attack', 100)
        ->assertJsonPath('quests.0', 'NOT_STARTED')
        ->assertJsonPath('diaries', []);

    expect(MemberSnapshot::query()->count())->toBe(1);
    Http::assertSentCount(1);
});

it('does not create a clear baseline before skills are uploaded', function () {
    $group = $this->createSnapshotGroup();
    $member = Member::create([
        'group_id' => $group->id,
        'name' => 'Alice',
    ]);

    $this->withHeader('Authorization', $group->hash)
        ->postJson("/api/group/{$group->name}/snapshots", [
            'name' => $member->name,
        ])
        ->assertConflict();

    expect(MemberSnapshot::query()->count())->toBe(0);
    Http::assertNothingSent();
});
