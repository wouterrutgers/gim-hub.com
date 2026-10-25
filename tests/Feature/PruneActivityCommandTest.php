<?php

use App\Models\ActivityEntry;
use App\Models\ActivityReceipt;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

it('combines completed old weeks while retaining an older card with recent gains', function (): void {
    $this->travelTo(CarbonImmutable::parse('2026-10-25 12:00:00'));
    $group = $this->createSnapshotGroup();
    $member = $this->createCompleteSnapshotMember($group);
    $attributes = ['group_id' => $group->id, 'member_id' => $member->id, 'revision' => 1, 'type' => 'xp', 'started_at' => now()->subDays(40)->getTimestampMs(), 'data' => ['skills' => ['Attack' => 100]]];
    $expired = ActivityEntry::create([...$attributes, 'source_id' => Str::uuid()->toString(), 'occurred_at' => now()->subDays(40)->getTimestampMs()]);
    $retained = ActivityEntry::create([...$attributes, 'source_id' => Str::uuid()->toString(), 'occurred_at' => now()->subDays(29)->getTimestampMs()]);
    $boundary = ActivityEntry::create([...$attributes, 'source_id' => Str::uuid()->toString(), 'occurred_at' => now()->subDays(30)->startOfWeek()->getTimestampMs()]);
    ActivityReceipt::create(['member_id' => $member->id, 'source_id' => $expired->source_id, 'activity_entry_id' => $expired->id]);
    $this->artisan('activity:prune')->assertSuccessful();
    $this->assertModelMissing($expired);
    $this->assertModelExists($retained);
    $this->assertModelExists($boundary);
    expect(ActivityEntry::where('is_weekly', '=', value: true)->sole()->data['skills'])->toBe(['Attack' => 100]);
    expect(ActivityReceipt::query()->count())->toBe(0);
});

it('preserves weekly totals and milestones per player and subject through the activity API', function (): void {
    $this->freezeTime();
    $group = $this->createSnapshotGroup();
    $member = $this->createCompleteSnapshotMember($group);
    $teammate = $this->createCompleteSnapshotMember($group, 'Bob');
    $otherGroup = $this->createSnapshotGroup('other-group');
    $otherMember = $this->createCompleteSnapshotMember($otherGroup);
    $week = CarbonImmutable::parse('2026-09-07');
    $samples = [
        ['xp', ['skills' => ['Attack' => 100]]],
        ['xp', ['skills' => ['Attack' => 150, 'Hitpoints' => 30]]],
        ['level', ['skill' => 'Attack', 'before' => 96, 'after' => 98]],
        ['level', ['skill' => 'Attack', 'before' => 98, 'after' => 99]],
        ['boss', ['boss' => 'Vorkath', 'count_type' => 'kill', 'count' => 2, 'total_count' => 50]],
        ['boss', ['boss' => 'Vorkath', 'count_type' => 'kill', 'count' => 3, 'total_count' => 53]],
        ['boss', ['boss' => 'Zulrah', 'count_type' => 'kill', 'count' => 1, 'total_count' => 20]],
        ['quest', ['quest_id' => 17, 'quest_name' => 'Druidic Ritual']],
        ['quest', ['quest_id' => 18, 'quest_name' => 'Cook\'s Assistant']],
        ['diary', ['region' => 'Falador', 'tier' => 'Easy', 'tasks' => [0, 1], 'complete' => false]],
        ['diary', ['region' => 'Falador', 'tier' => 'Easy', 'tasks' => [1, 2], 'complete' => true]],
        ['loot', ['item_id' => 4151, 'quantity' => 1, 'value' => 1_800_000, 'source' => 'Abyssal Sire', 'new_collection_item' => false]],
        ['loot', ['item_id' => 4151, 'quantity' => 2, 'value' => 3_900_000, 'source' => 'Abyssal Sire', 'new_collection_item' => true]],
        ['loot', ['item_id' => 4151, 'quantity' => 1, 'value' => 1_900_000, 'source' => 'Abyssal demon', 'new_collection_item' => false]],
        ['collection', ['item_id' => 4151, 'quantity' => 1, 'value' => 5, 'source' => 'Abyssal Sire', 'new_collection_item' => false]],
        ['collection', ['item_id' => 4151, 'quantity' => 2, 'value' => 10, 'source' => 'Abyssal Sire', 'new_collection_item' => false]],
    ];

    foreach ($samples as $index => [$type, $data]) {
        ActivityEntry::create([
            'group_id' => $group->id, 'member_id' => $member->id,
            'source_id' => Str::uuid()->toString(), 'revision' => 1, 'type' => $type,
            'started_at' => $week->addHours($index)->getTimestampMs(),
            'occurred_at' => $week->addHours($index + 1)->getTimestampMs(), 'data' => $data,
        ]);
    }

    foreach ([[$teammate, $week], [$otherMember, $week], [$member, $week->addWeek()]] as [$player, $date]) {
        ActivityEntry::create([
            'group_id' => $player->group_id, 'member_id' => $player->id,
            'source_id' => Str::uuid()->toString(), 'revision' => 1, 'type' => 'xp',
            'started_at' => $date->getTimestampMs(), 'occurred_at' => $date->getTimestampMs(),
            'data' => ['skills' => ['Attack' => 1000]],
        ]);
    }

    $this->artisan('activity:prune')->assertSuccessful();
    $this->artisan('activity:prune')->assertSuccessful();
    $response = $this->withHeader('Authorization', $group->hash)->getJson("/api/group/{$group->name}/activity")
        ->assertSuccessful()->assertJsonCount(12, 'entries');
    $entries = collect($response->json('entries'));
    $cards = $entries->where('member_id', '=', $member->id)->where('started_at', '=', $week->getTimestampMs());

    expect($entries->every(fn (array $entry): bool => $entry['is_weekly']))->toBeTrue();
    expect($entries->pluck('member_id')->unique()->sort()->values()->all())->toBe([$member->id, $teammate->id]);
    expect($entries->where('started_at', '=', $week->addWeek()->getTimestampMs())->sole()['data']['skills']['Attack'])->toBe(1000);
    expect($cards->where('type', '=', 'xp')->sole()['data']['skills'])->toBe(['Attack' => 250, 'Hitpoints' => 30]);
    expect($cards->where('type', '=', 'level')->sole()['data'])->toBe(['skill' => 'Attack', 'before' => 96, 'after' => 99]);
    expect($cards->where('type', '=', 'boss')->where('data.boss', '=', 'Vorkath')->sole()['data'])->toBe(['boss' => 'Vorkath', 'count_type' => 'kill', 'count' => 5, 'total_count' => 53]);
    expect($cards->where('type', '=', 'quest')->pluck('data.quest_id')->sort()->values()->all())->toBe([17, 18]);
    expect($cards->where('type', '=', 'diary')->sole()['data'])->toBe(['region' => 'Falador', 'tier' => 'Easy', 'tasks' => [0, 1, 2], 'complete' => true]);
    expect($cards->where('type', '=', 'loot')->where('data.source', '=', 'Abyssal Sire')->sole()['data'])->toBe(['item_id' => 4151, 'quantity' => 3, 'value' => 5_700_000, 'source' => 'Abyssal Sire', 'new_collection_item' => true]);
    expect($cards->where('type', '=', 'collection')->sole()['data']['quantity'])->toBe(3);
});
