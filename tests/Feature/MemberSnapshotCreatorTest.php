<?php

use App\Domain\MemberSnapshotCreator;
use App\Models\Member;
use App\Models\MemberSnapshot;
use Illuminate\Support\Facades\Http;

it('merges higher hiscores experience without lowering stored experience', function () {
    Http::fake([
        '*' => Http::response($this->snapshotHiscoresResponse(
            skillExperience: [
                'Agility' => 50,
                'Attack' => 500,
            ],
            activities: [
                ['name' => 'Abyssal Sire', 'score' => 42],
                ['name' => 'Clue Scrolls (easy)', 'score' => 7],
            ],
        )),
    ]);

    $member = $this->createCompleteSnapshotMember($this->createSnapshotGroup());

    $snapshot = app(MemberSnapshotCreator::class)->create($member);

    expect($snapshot)->toBeInstanceOf(MemberSnapshot::class)
        ->and($snapshot->snapshot['skills']['Agility'])->toBe(100)
        ->and($snapshot->snapshot['skills']['Attack'])->toBe(500)
        ->and($snapshot->snapshot['bossKc'])->toBe([
            'Abyssal Sire' => 42,
            'Clue Scrolls (easy)' => 7,
        ]);

    $storedSkills = $member->properties()
        ->where('key', '=', 'skills')
        ->firstOrFail()
        ->value;

    expect($storedSkills[0])->toBe(100)
        ->and($storedSkills[1])->toBe(500);

    $this->assertModelExists($snapshot);
});

it('creates a snapshot with stored skills when hiscores are unavailable', function () {
    Http::fake([
        '*' => Http::failedConnection(),
    ]);

    $member = $this->createCompleteSnapshotMember($this->createSnapshotGroup());

    $snapshot = app(MemberSnapshotCreator::class)->create($member);

    expect($snapshot)->toBeInstanceOf(MemberSnapshot::class)
        ->and($snapshot->snapshot['skills']['Attack'])->toBe(100)
        ->and($snapshot->snapshot['bossKc'])->toBe([])
        ->and($member->properties()->where('key', '=', 'skills')->firstOrFail()->value)
        ->toBe(array_fill(0, 24, 100));
});

it('snapshots member data committed while hiscores are loading without overwriting newer skills', function () {
    $member = $this->createCompleteSnapshotMember($this->createSnapshotGroup());
    Http::fake(function () use ($member) {
        $skills = array_fill(0, 24, 100);
        $skills[1] = 700;

        $member->properties()->where('key', '=', 'skills')->firstOrFail()->update(['value' => $skills]);
        $member->properties()->where('key', '=', 'quests')->firstOrFail()->update(['value' => [0]]);

        $diaries = array_fill(0, 62, 0);
        $diaries[0] = 1;
        $member->properties()->where('key', '=', 'diary_vars')->firstOrFail()->update(['value' => $diaries]);
        $member->collectionLogs()->create([
            'item_id' => 4151,
            'item_count' => 3,
        ]);

        return Http::response($this->snapshotHiscoresResponse(skillExperience: ['Attack' => 500]));
    });

    $snapshot = app(MemberSnapshotCreator::class)->create($member);

    expect($snapshot)->toBeInstanceOf(MemberSnapshot::class)
        ->and($snapshot->snapshot['skills']['Attack'])->toBe(700)
        ->and($snapshot->snapshot['quests'][0])->toBe('IN_PROGRESS')
        ->and($snapshot->snapshot['diaries'][0])->toBe(1)
        ->and($snapshot->snapshot['collection'][4151])->toBe(3)
        ->and($member->properties()->where('key', '=', 'skills')->firstOrFail()->value[1])->toBe(700);
});

it('creates a snapshot with stored skills after an unsuccessful hiscores response', function (int $status) {
    Http::fake([
        '*' => Http::response([], $status),
    ]);

    $member = $this->createCompleteSnapshotMember($this->createSnapshotGroup());

    $snapshot = app(MemberSnapshotCreator::class)->create($member);

    expect($snapshot)->toBeInstanceOf(MemberSnapshot::class)
        ->and($snapshot->snapshot['skills']['Attack'])->toBe(100)
        ->and($snapshot->snapshot['bossKc'])->toBe([])
        ->and($member->properties()->where('key', '=', 'skills')->firstOrFail()->value)
        ->toBe(array_fill(0, 24, 100));
})->with([
    'not found' => 404,
    'server error' => 503,
]);

it('creates a snapshot from partially updated member data', function () {
    Http::fake([
        '*' => Http::response([], 404),
    ]);

    $group = $this->createSnapshotGroup();
    $member = Member::create([
        'group_id' => $group->id,
        'name' => 'Alice',
    ]);
    $member->properties()->createMany([
        ['key' => 'skills', 'value' => [100]],
        ['key' => 'quests', 'value' => []],
        ['key' => 'diary_vars', 'value' => [1]],
    ]);

    $snapshot = app(MemberSnapshotCreator::class)->create($member);

    expect($snapshot->snapshot['skills']['Agility'])->toBe(100)
        ->and($snapshot->snapshot['skills']['Attack'])->toBe(0)
        ->and($snapshot->snapshot['quests'][0])->toBe('NOT_STARTED')
        ->and($snapshot->snapshot['diaries'])->toBe([1]);

    $this->assertModelExists($snapshot);
    Http::assertSentCount(1);
});
