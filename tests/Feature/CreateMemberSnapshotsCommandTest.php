<?php

use App\Jobs\CreateMemberSnapshot;
use App\Models\Member;
use Illuminate\Support\Facades\Queue;

it('queues recently updated members and globally prunes expired snapshots', function () {
    $group = $this->createSnapshotGroup();
    $eligibleMember = $this->createCompleteSnapshotMember($group);
    $staleUpdatedAt = now()->subWeeks(3);

    $partiallyUpdatedMember = Member::create([
        'group_id' => $group->id,
        'name' => 'Incomplete',
    ]);
    $partiallyUpdatedMember->properties()->create([
        'key' => 'skills',
        'value' => array_fill(0, 24, 100),
        'updated_at' => $staleUpdatedAt,
    ]);
    $partiallyUpdatedMember->properties()->create([
        'key' => 'quests',
        'value' => [],
    ]);
    Member::create([
        'group_id' => $group->id,
        'name' => 'No data',
    ]);
    $staleMember = $this->createCompleteSnapshotMember($group, 'Stale');
    foreach ($staleMember->properties as $property) {
        $property->update(['updated_at' => $staleUpdatedAt]);
    }

    $this->createCompleteSnapshotMember($group, Member::SHARED_MEMBER);

    $expiredSnapshot = $partiallyUpdatedMember->snapshots()->create([
        'snapshot' => $this->snapshotPayload(now()->subDays(8)->getTimestamp() * 1000),
        'created_at' => now()->subDays(8),
        'updated_at' => now()->subDays(8),
    ]);
    $retainedSnapshot = $partiallyUpdatedMember->snapshots()->create([
        'snapshot' => $this->snapshotPayload(now()->subDays(6)->getTimestamp() * 1000),
        'created_at' => now()->subDays(6),
        'updated_at' => now()->subDays(6),
    ]);

    Queue::fake();

    $this->artisan('member-snapshots:create')->assertSuccessful();

    Queue::assertPushed(CreateMemberSnapshot::class, 2);
    Queue::assertPushed(
        CreateMemberSnapshot::class,
        fn (CreateMemberSnapshot $job): bool => $job->uniqueId() === (string) $eligibleMember->id,
    );
    Queue::assertPushed(
        CreateMemberSnapshot::class,
        fn (CreateMemberSnapshot $job): bool => $job->uniqueId() === (string) $partiallyUpdatedMember->id,
    );
    Queue::assertNotPushed(
        CreateMemberSnapshot::class,
        fn (CreateMemberSnapshot $job): bool => $job->uniqueId() === (string) $staleMember->id,
    );
    $this->assertModelMissing($expiredSnapshot);
    $this->assertModelExists($retainedSnapshot);
});
