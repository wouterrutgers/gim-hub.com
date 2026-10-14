<?php

use App\Models\ActivityEntry;
use Illuminate\Support\Str;

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
