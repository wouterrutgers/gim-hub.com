<?php

use App\Models\AggregationInfo;
use App\Models\SkillStat;
use Carbon\CarbonImmutable;
use GuzzleHttp\Promise\PromiseInterface;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

it('records five minute snapshots and updates the hourly and monthly totals', function (): void {
    $this->travelTo(CarbonImmutable::parse('2026-09-07 12:02:00'));
    $member = $this->createCompleteSnapshotMember($this->createSnapshotGroup());

    $this->artisan('skills:aggregate')->assertSuccessful();
    $this->travelTo(CarbonImmutable::parse('2026-09-07 12:04:00'));
    $member->getProperty('skills')->update(['value' => array_fill(0, 24, 200)]);
    $this->artisan('skills:aggregate')->assertSuccessful();
    $this->travelTo(CarbonImmutable::parse('2026-09-07 12:07:00'));
    $member->getProperty('skills')->update(['value' => array_fill(0, 24, 300)]);
    $this->artisan('skills:aggregate')->assertSuccessful();
    $this->artisan('skills:aggregate')->assertSuccessful();

    expect($member->skillStats()->where('type', '=', 'five_minutes')->orderBy('created_at')->get()->pluck('attack')->all())->toBe([200, 300]);
    $this->assertDatabaseHas('skill_stats', ['member_id' => $member->id, 'type' => 'five_minutes', 'created_at' => '2026-09-07 12:05:00', 'attack' => 300]);
    $this->assertDatabaseHas('skill_stats', ['member_id' => $member->id, 'type' => 'hourly', 'created_at' => '2026-09-07 12:00:00', 'attack' => 300]);
    $this->assertDatabaseHas('skill_stats', ['member_id' => $member->id, 'type' => 'monthly', 'created_at' => '2026-09-01 00:00:00', 'attack' => 300]);
    $this->assertDatabaseCount('skill_stats', 4);

    $this->travelTo(CarbonImmutable::parse('2026-09-07 13:00:00'));
    $this->artisan('skills:aggregate')->assertSuccessful();
    $this->assertDatabaseCount('skill_stats', 4);
});

it('retains each tier and its preceding baseline without expiring monthly history', function (): void {
    $this->travelTo(CarbonImmutable::parse('2026-09-07 12:00:00'));
    AggregationInfo::create(['type' => 'skills', 'updated_at' => now()]);
    $member = $this->createCompleteSnapshotMember($this->createSnapshotGroup());
    $otherMember = $this->createCompleteSnapshotMember($this->createSnapshotGroup('other'));

    foreach ([$member, $otherMember] as $currentMember) {
        foreach (['five_minutes' => '2026-08-08 12:00:00', 'hourly' => '2025-09-07 12:00:00', 'daily' => '2026-08-07 12:00:00'] as $type => $cutoff) {
            foreach ([-2, -1, 0, 1] as $offset) {
                $currentMember->skillStats()->create([
                    'type' => $type,
                    'skills' => array_fill(0, 24, 100 + $offset),
                    'created_at' => CarbonImmutable::parse($cutoff)->addHours($offset),
                ]);
            }
        }
    }
    foreach (['2020-01-01', '2021-01-01'] as $time) {
        $member->skillStats()->create(['type' => 'monthly', 'skills' => array_fill(0, 24, 1), 'created_at' => $time]);
    }

    $this->artisan('skills:retention')->assertSuccessful();

    expect(SkillStat::where('type', '=', 'monthly')->count())->toBe(2);
    foreach ([$member, $otherMember] as $currentMember) {
        foreach (['five_minutes', 'hourly', 'daily'] as $type) {
            expect($currentMember->skillStats()->where('type', '=', $type)->orderBy('created_at')->get()->pluck('attack')->all())->toBe([99, 100, 101]);
        }
    }
});

it('does not prune history before the first successful aggregation', function (): void {
    $member = $this->createCompleteSnapshotMember($this->createSnapshotGroup());
    foreach (['2020-01-01', '2020-02-01'] as $time) {
        $member->skillStats()->create(['type' => 'hourly', 'skills' => array_fill(0, 24, 1), 'created_at' => $time]);
    }

    $this->artisan('skills:retention')->assertSuccessful();

    $this->assertDatabaseCount('skill_stats', 2);
});

it('imports external history into integer columns and the correct retention tiers', function (): void {
    Http::fake([
        'https://groupiron.men/api/group/imported/get-group-data*' => Http::response([['name' => 'Alice']]),
        'https://groupiron.men/api/group/imported/get-skill-data*' => function (Request $request): PromiseInterface {
            $time = match ($request['period']) {
                'Day' => '2026-09-07T12:00:00Z',
                'Week' => '2026-09-06T00:00:00Z',
                'Month' => '2026-08-15T00:00:00Z',
                'Year' => '2026-01-01T00:00:00Z',
            };

            return Http::response([
                ['name' => 'Alice', 'skill_data' => [['time' => $time, 'data' => range(1, 24)]]],
            ]);
        },
    ]);

    $this->artisan('groupiron:import', ['--name' => 'imported', '--token' => 'import-token'])->assertSuccessful();

    expect(SkillStat::oldest()->get()->pluck('type')->all())->toBe(['monthly', 'daily', 'daily', 'hourly']);
    expect(SkillStat::oldest()->first()->skills)->toBe(range(1, 24));
});
