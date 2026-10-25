<?php

use App\Models\ActivityEntry;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

it('keeps cumulative activity totals through repeated and stale uploads', function (): void {
    $group = $this->createSnapshotGroup();
    $member = $this->createCompleteSnapshotMember($group);
    $first = $this->activityUpdate('xp', ['skills' => ['Attack' => 100, 'Hitpoints' => 30]]);
    $second = [...$first, 'revision' => 2, 'data' => ['skills' => ['Attack' => 200, 'Hitpoints' => 60]]];

    foreach ([$first, $second, $second, $first] as $update) {
        $this->withHeader('Authorization', $group->hash)
            ->postJson("/api/group/{$group->name}/update-group-member", ['name' => $member->name, 'activity_updates' => [$update]])
            ->assertSuccessful();
    }
    $this->withHeader('Authorization', $group->hash)->getJson("/api/group/{$group->name}/activity")
        ->assertSuccessful()->assertJsonCount(1, 'entries')
        ->assertJsonPath('entries.0.data.skills.Attack', 200)
        ->assertJsonPath('entries.0.data.skills.Hitpoints', 60)->assertJsonPath('entries.0.revision', 2);
});

it('rejects malformed activity before changing any member data', function (): void {
    $group = $this->createSnapshotGroup();
    $member = $this->createCompleteSnapshotMember($group);
    $invalid = $this->activityUpdate('loot', ['item_id' => 4151, 'quantity' => -1, 'value' => 100, 'source' => 'Abyssal Sire', 'new_collection_item' => false]);
    $this->withHeader('Authorization', $group->hash)
        ->postJson("/api/group/{$group->name}/update-group-member", ['name' => $member->name, 'skills' => array_fill(0, 24, 200), 'activity_updates' => [$invalid]])
        ->assertUnprocessable()->assertJsonValidationErrors('activity_updates.0.data.quantity');
    expect($member->properties()->where('key', '=', 'skills')->sole()->value)->toBe(array_fill(0, 24, 100));
    expect(ActivityEntry::query()->count())->toBe(0);
});

it('announces valuable loot and new unlocks while grouping repeat collection acquisitions once', function (): void {
    $group = $this->createSnapshotGroup();
    $member = $this->createCompleteSnapshotMember($group);
    $valuable = $this->activityUpdate('loot', ['item_id' => 4151, 'quantity' => 1, 'value' => 2000000, 'source' => 'Abyssal Sire', 'new_collection_item' => true]);
    $repeat = $this->activityUpdate('loot', ['item_id' => 4151, 'quantity' => 1, 'value' => 100, 'source' => 'Abyssal Sire', 'new_collection_item' => false]);
    $another = [...$repeat, 'id' => Str::uuid()->toString()];
    $ordinary = $this->activityUpdate('loot', ['item_id' => 314, 'quantity' => 10, 'value' => 20, 'source' => 'Chicken', 'new_collection_item' => false]);

    foreach ([$valuable, $repeat, $another, $repeat, $another, $ordinary] as $update) {
        $this->withHeader('Authorization', $group->hash)
            ->postJson("/api/group/{$group->name}/update-group-member", ['name' => $member->name, 'activity_updates' => [$update]])->assertSuccessful();
    }
    expect(ActivityEntry::where('type', '=', 'loot')->sole()->data['new_collection_item'])->toBeTrue();
    expect(ActivityEntry::where('type', '=', 'collection')->sole()->data['quantity'])->toBe(2);
    expect(ActivityEntry::query()->count())->toBe(2);
});

it('records diary progress from the existing bit and value definitions without treating every change as a task', function (): void {
    $group = $this->createSnapshotGroup();
    $member = $this->createCompleteSnapshotMember($group);
    $before = array_fill(0, 62, 0);
    $after = $before;
    $after[0] = 1;
    $after[23] = 1;
    $first = $this->activityUpdate('diary', ['before' => $before, 'after' => $after]);
    $this->withHeader('Authorization', $group->hash)
        ->postJson("/api/group/{$group->name}/update-group-member", ['name' => $member->name, 'activity_updates' => [$first]])->assertSuccessful();
    expect(ActivityEntry::query()->count())->toBe(1);
    $after[23] = 5;
    $this->withHeader('Authorization', $group->hash)
        ->postJson("/api/group/{$group->name}/update-group-member", ['name' => $member->name, 'activity_updates' => [[...$first, 'revision' => 2, 'data' => ['before' => $before, 'after' => $after]]]])->assertSuccessful();
    expect(ActivityEntry::where('subject', '=', 'Ardougne:Easy')->sole()->data['tasks'])->toBe([0]);
    expect(ActivityEntry::where('subject', '=', 'Karamja:Easy')->sole()->data['tasks'])->toBe([0]);
});

it('keeps late collection drops separate from the previous weekly summary', function (): void {
    $this->travelTo(CarbonImmutable::parse('2026-10-21 00:05:00'));
    $group = $this->createSnapshotGroup();
    $member = $this->createCompleteSnapshotMember($group);
    $data = ['item_id' => 4151, 'quantity' => 1, 'value' => 100, 'source' => 'Abyssal Sire', 'new_collection_item' => false];
    ActivityEntry::create([
        'group_id' => $group->id, 'member_id' => $member->id,
        'source_id' => Str::uuid()->toString(), 'revision' => 1, 'type' => 'collection',
        'started_at' => CarbonImmutable::parse('2026-09-20 23:55:00')->getTimestampMs(),
        'occurred_at' => CarbonImmutable::parse('2026-09-20 23:55:00')->getTimestampMs(), 'data' => $data,
    ]);
    $this->artisan('activity:prune')->assertSuccessful();
    $late = [
        ...$this->activityUpdate('loot', $data),
        'started_at' => CarbonImmutable::parse('2026-09-21 00:06:00')->getTimestampMs(),
        'occurred_at' => CarbonImmutable::parse('2026-09-21 00:06:00')->getTimestampMs(),
    ];
    $this->withHeader('Authorization', $group->hash)
        ->postJson("/api/group/{$group->name}/update-group-member", ['name' => $member->name, 'activity_updates' => [$late]])->assertSuccessful();

    expect(ActivityEntry::where('is_weekly', '=', value: true)->sole()->data['quantity'])->toBe(1);
    expect(ActivityEntry::where('is_weekly', '=', value: false)->sole()->data['quantity'])->toBe(1);
});
