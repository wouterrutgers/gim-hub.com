<?php

use App\Models\ActivityEntry;
use App\Models\ActivityReceipt;
use Illuminate\Support\Str;

it('prunes expired activity while retaining an older card with recent gains', function (): void {
    $group = $this->createSnapshotGroup();
    $member = $this->createCompleteSnapshotMember($group);
    $attributes = ['group_id' => $group->id, 'member_id' => $member->id, 'revision' => 1, 'type' => 'xp', 'started_at' => now()->subDays(31)->getTimestampMs(), 'data' => ['skills' => ['Attack' => 100]]];
    $expired = ActivityEntry::create([...$attributes, 'source_id' => Str::uuid()->toString(), 'occurred_at' => now()->subDays(31)->getTimestampMs()]);
    $retained = ActivityEntry::create([...$attributes, 'source_id' => Str::uuid()->toString(), 'occurred_at' => now()->subDays(29)->getTimestampMs()]);
    ActivityReceipt::create(['member_id' => $member->id, 'source_id' => $expired->source_id, 'activity_entry_id' => $expired->id]);
    $this->artisan('activity:prune')->assertSuccessful();
    $this->assertModelMissing($expired);
    $this->assertModelExists($retained);
    expect(ActivityReceipt::query()->count())->toBe(0);
});
