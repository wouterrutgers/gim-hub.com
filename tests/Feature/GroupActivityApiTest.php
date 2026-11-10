<?php

use App\Models\ActivityEntry;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

it('retrieves uploads that become visible after the polling watermark passes their timestamp', function (): void {
    $this->freezeTime();
    $group = $this->createSnapshotGroup();
    $member = $this->createCompleteSnapshotMember($group);
    $writtenAt = now()->subSecond();
    $page = $this->withHeader('Authorization', $group->hash)->getJson("/api/group/{$group->name}/activity")
        ->assertSuccessful()->assertJsonCount(0, 'entries');
    $this->travel(5)->seconds();
    $from = urlencode($page->json('from_time'));
    $poll = $this->getJson("/api/group/{$group->name}/activity?from_time={$from}")
        ->assertSuccessful()->assertJsonCount(0, 'entries');

    $entry = ActivityEntry::create([
        'member_id' => $member->id, 'group_id' => $group->id,
        'source_id' => Str::uuid()->toString(), 'revision' => 1, 'type' => 'quest',
        'started_at' => $writtenAt->getTimestampMs(), 'occurred_at' => $writtenAt->getTimestampMs(),
        'data' => ['quest_id' => 0, 'quest_name' => 'Druidic Ritual'],
        'created_at' => $writtenAt, 'updated_at' => $writtenAt,
    ]);
    $this->travel(5)->seconds();
    $from = urlencode($poll->json('from_time'));

    $this->getJson("/api/group/{$group->name}/activity?from_time={$from}")
        ->assertSuccessful()->assertJsonCount(1, 'entries')->assertJsonPath('entries.0.id', $entry->id);
});

it('paginates group history and returns updates to older cards without leaking another group', function (): void {
    $this->freezeTime();
    $group = $this->createSnapshotGroup();
    $member = $this->createCompleteSnapshotMember($group, '0');
    $otherGroup = $this->createSnapshotGroup('other-group');
    $otherMember = $this->createCompleteSnapshotMember($otherGroup);

    for ($index = 0; $index < 51; $index++) {
        ActivityEntry::create(['member_id' => $member->id, 'group_id' => $group->id, 'source_id' => Str::uuid()->toString(), 'revision' => 1, 'type' => 'boss', 'started_at' => now()->subMinutes(51 - $index)->getTimestampMs(), 'occurred_at' => now()->getTimestampMs(), 'data' => ['boss' => 'Vorkath', 'count_type' => 'kill', 'count' => 1, 'total_count' => 100 + $index]]);
    }
    ActivityEntry::create(['member_id' => $otherMember->id, 'group_id' => $otherGroup->id, 'source_id' => Str::uuid()->toString(), 'revision' => 1, 'type' => 'quest', 'started_at' => now()->getTimestampMs(), 'occurred_at' => now()->getTimestampMs(), 'data' => ['quest_id' => 0, 'quest_name' => 'Other quest']]);
    $page = $this->withHeader('Authorization', $group->hash)->getJson("/api/group/{$group->name}/activity")->assertSuccessful()->assertJsonCount(50, 'entries')->assertJsonPath('entries.0.member_id', $member->id);
    $cursor = urlencode($page->json('older_cursor'));
    $this->withHeader('Authorization', $group->hash)->getJson("/api/group/{$group->name}/activity?cursor={$cursor}")->assertSuccessful()->assertJsonCount(1, 'entries')->assertJsonPath('entries.0.data.total_count', 100);
    $this->travel(1)->seconds();
    $oldest = ActivityEntry::where('member_id', '=', $member->id)->orderBy('started_at')->firstOrFail();
    $oldest->update(['revision' => 2, 'data' => ['boss' => 'Vorkath', 'count_type' => 'kill', 'count' => 2, 'total_count' => 101]]);
    $from = urlencode($page->json('from_time'));
    $this->withHeader('Authorization', $group->hash)->getJson("/api/group/{$group->name}/activity?from_time={$from}")
        ->assertSuccessful()->assertJsonPath('entries.0.data.count', 2);
    $this->withHeader('Authorization', $otherGroup->hash)->getJson("/api/group/{$group->name}/activity")->assertUnauthorized();
    $this->travel(1)->seconds();
    $this->withHeader('Authorization', $group->hash)->putJson("/api/group/{$group->name}/rename-group-member", ['original_name' => '0', 'new_name' => 'Renamed'])->assertSuccessful();
    expect($oldest->fresh()->updated_at)->toEqual($oldest->updated_at);
    $this->withHeader('Authorization', $group->hash)->getJson("/api/group/{$group->name}/activity?from_time={$from}")->assertSuccessful()->assertJsonPath('entries.0.member_id', $member->id);
    $this->withHeader('Authorization', $group->hash)->getJson("/api/group/{$group->name}/get-group-data?from_time=2000-01-01")
        ->assertSuccessful()->assertJsonPath('0.id', $member->id)->assertJsonPath('0.name', 'Renamed');
    $this->withHeader('Authorization', $group->hash)->deleteJson("/api/group/{$group->name}/delete-group-member", ['name' => 'Renamed'])->assertSuccessful();
    $this->withHeader('Authorization', $group->hash)->getJson("/api/group/{$group->name}/activity")->assertSuccessful()->assertJsonCount(0, 'entries');

});

it('only announces ordinary drops worth at least one million GP', function (): void {
    $group = $this->createSnapshotGroup();
    $member = $this->createCompleteSnapshotMember($group);
    $ordinary = $this->activityUpdate('loot', ['item_id' => 314, 'quantity' => 100, 'value' => 999_999, 'source' => 'Chicken', 'new_collection_item' => false]);
    $valuable = $this->activityUpdate('loot', ['item_id' => 4151, 'quantity' => 1, 'value' => 1_000_000, 'source' => 'Abyssal Sire', 'new_collection_item' => false]);

    $this->withHeader('Authorization', $group->hash)
        ->postJson("/api/group/{$group->name}/update-group-member", ['name' => $member->name, 'activity_updates' => [$ordinary, $valuable]])->assertSuccessful();

    $this->withHeader('Authorization', $group->hash)->getJson("/api/group/{$group->name}/activity")
        ->assertSuccessful()->assertJsonCount(1, 'entries')->assertJsonPath('entries.0.data.value', 1_000_000);
});

it('returns complete player days with independent period pagination and group isolation', function (): void {
    $this->travelTo(CarbonImmutable::parse('2026-11-09T12:00:00Z'));
    $group = $this->createSnapshotGroup();
    $member = $this->createCompleteSnapshotMember($group);
    $otherMember = $this->createCompleteSnapshotMember($this->createSnapshotGroup('other-group'));

    for ($index = 0; $index < 60; $index++) {
        ActivityEntry::create([
            'member_id' => $member->id, 'group_id' => $group->id, 'source_id' => Str::uuid()->toString(),
            'revision' => 1, 'type' => 'xp', 'started_at' => now()->subMinutes($index)->getTimestampMs(),
            'occurred_at' => now()->getTimestampMs(), 'data' => ['skills' => ['Attack' => 100]],
        ]);
    }

    for ($day = 1; $day <= 7; $day++) {
        ActivityEntry::create([
            'member_id' => $member->id, 'group_id' => $group->id, 'source_id' => Str::uuid()->toString(),
            'revision' => 1, 'type' => 'xp', 'started_at' => now()->subDays($day)->getTimestampMs(),
            'occurred_at' => now()->subDays($day)->getTimestampMs(), 'data' => ['skills' => ['Attack' => 100]],
        ]);
    }

    ActivityEntry::create([
        'member_id' => $member->id, 'group_id' => $group->id, 'source_id' => Str::uuid()->toString(),
        'revision' => 1, 'type' => 'xp', 'is_weekly' => true,
        'started_at' => CarbonImmutable::parse('2026-09-07T00:00:00Z')->getTimestampMs(),
        'occurred_at' => CarbonImmutable::parse('2026-09-13T12:00:00Z')->getTimestampMs(),
        'data' => ['skills' => ['Attack' => 1000]],
    ]);
    $url = "/api/group/{$group->name}/activity/player/{$member->id}";
    $page = $this->withHeader('Authorization', $group->hash)->getJson("{$url}?timezone=Europe/Amsterdam")
        ->assertSuccessful()->assertJsonCount(7, 'periods')->assertJsonCount(60, 'periods.0.entries');
    $cursor = urlencode($page->json('older_cursor'));
    $this->getJson("{$url}?timezone=Europe/Amsterdam&cursor={$cursor}")->assertSuccessful()
        ->assertJsonCount(2, 'periods')->assertJsonCount(1, 'periods.0.entries')
        ->assertJsonPath('periods.1.kind', 'week')->assertJsonPath('older_cursor', null);
    $this->getJson("/api/group/{$group->name}/activity/player/{$otherMember->id}?timezone=UTC")->assertNotFound();
    $this->getJson("{$url}?timezone=invalid")->assertUnprocessable()->assertJsonValidationErrors('timezone');
    $this->getJson("{$url}?timezone=UTC&cursor=invalid")->assertUnprocessable()->assertJsonValidationErrors('cursor');
    $this->withHeader('Authorization', 'wrong-token')->getJson("{$url}?timezone=UTC")->assertUnauthorized();
});

it('uses complete local days across daylight saving boundaries', function (string $start, string $end, int $hours): void {
    $group = $this->createSnapshotGroup();
    $member = $this->createCompleteSnapshotMember($group);
    $start = CarbonImmutable::parse($start)->getTimestampMs();
    $end = CarbonImmutable::parse($end)->getTimestampMs();

    foreach ([$start - 1, $start, $end - 1, $end] as $timestamp) {
        ActivityEntry::create([
            'member_id' => $member->id, 'group_id' => $group->id, 'source_id' => Str::uuid()->toString(),
            'revision' => 1, 'type' => 'xp', 'started_at' => $timestamp, 'occurred_at' => $timestamp,
            'data' => ['skills' => ['Attack' => 100]],
        ]);
    }

    $page = $this->withHeader('Authorization', $group->hash)
        ->getJson("/api/group/{$group->name}/activity/player/{$member->id}?timezone=Europe/Amsterdam")
        ->assertSuccessful()->assertJsonCount(3, 'periods')->assertJsonCount(2, 'periods.1.entries')
        ->assertJsonPath('periods.1.started_at', $start)->assertJsonPath('periods.1.ended_at', $end);
    expect($page->json('periods.1.ended_at') - $page->json('periods.1.started_at'))->toBe($hours * 60 * 60 * 1000);
})->with([
    'spring' => ['2026-03-28T23:00:00Z', '2026-03-29T22:00:00Z', 23],
    'autumn' => ['2026-10-24T22:00:00Z', '2026-10-25T23:00:00Z', 25],
]);

it('returns the whole changed player day when one recorded session grows', function (): void {
    $this->freezeTime();
    $group = $this->createSnapshotGroup();
    $member = $this->createCompleteSnapshotMember($group);
    $entries = collect([100, 200])->map(fn (int $quantity): ActivityEntry => ActivityEntry::create([
        'member_id' => $member->id, 'group_id' => $group->id, 'source_id' => Str::uuid()->toString(),
        'revision' => 1, 'type' => 'xp', 'started_at' => now()->subMinutes(5)->getTimestampMs(),
        'occurred_at' => now()->getTimestampMs(), 'data' => ['skills' => ['Attack' => $quantity]],
    ]));
    $url = "/api/group/{$group->name}/activity/player/{$member->id}?timezone=UTC";
    $first = $this->withHeader('Authorization', $group->hash)->getJson($url)->assertSuccessful();
    $this->travel(90)->seconds();
    $entries->first()->update(['revision' => 2, 'data' => ['skills' => ['Attack' => 300]]]);
    $from = urlencode($first->json('from_time'));
    $response = $this->getJson("{$url}&from_time={$from}")->assertSuccessful()
        ->assertJsonCount(1, 'periods')->assertJsonCount(2, 'periods.0.entries');
    expect(collect($response->json('periods.0.entries'))->sum('data.skills.Attack'))->toBe(500);
    expect(collect($response->json('periods.0.entries'))->firstWhere('id', $entries->first()->id)['revision'])->toBe(2);
});
