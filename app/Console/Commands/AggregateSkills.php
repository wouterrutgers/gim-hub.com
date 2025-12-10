<?php

namespace App\Console\Commands;

use App\Enums\AggregatePeriod;
use App\Models\AggregationInfo;
use App\Models\MemberProperty;
use App\Models\SkillStat;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class AggregateSkills extends Command
{
    protected $signature = 'skills:aggregate';

    protected $description = 'Aggregate member skills data';

    public function handle(): int
    {
        DB::transaction(function () {
            $lastAggregation = $this->getLastSkillsAggregation();

            AggregationInfo::updateOrCreate(
                ['type' => 'skills'],
                ['updated_at' => now()]
            );

            $this->aggregateSkillsForPeriod(AggregatePeriod::Day, $lastAggregation);
            $this->aggregateSkillsForPeriod(AggregatePeriod::Month, $lastAggregation);
            $this->aggregateSkillsForPeriod(AggregatePeriod::Year, $lastAggregation);
        });

        $this->info('Skills data aggregated successfully.');

        return static::SUCCESS;
    }

    protected function getLastSkillsAggregation(): Carbon
    {
        $lastAggregation = AggregationInfo::where('type', '=', 'skills')
            ->value('updated_at');

        return is_null($lastAggregation)
            ? Carbon::createFromTimestamp(0)
            : Carbon::parse($lastAggregation);
    }

    protected function aggregateSkillsForPeriod(AggregatePeriod $period, Carbon $lastAggregation): void
    {
        $properties = MemberProperty::where('key', '=', 'skills')
            ->where('updated_at', '>=', $lastAggregation)
            ->with('member')
            ->get();

        foreach ($properties as $property) {
            $member = $property->member;
            $timeValue = $this->getAggregateTimeValue($period, $property->updated_at);

            SkillStat::updateOrCreate(
                [
                    'member_id' => $member->id,
                    'type' => $period->value,
                    'created_at' => $timeValue,
                ],
                [
                    'skills' => $property->value,
                    'updated_at' => now(),
                ]
            );
        }
    }

    protected function getAggregateTimeValue(AggregatePeriod $period, $date): string
    {
        $date = is_string($date) ? Carbon::parse($date) : $date;

        return match ($period) {
            AggregatePeriod::Day => $date->copy()->minute(0)->second(0)->format('Y-m-d H:00:00'),
            AggregatePeriod::Month => $date->copy()->startOfDay()->format('Y-m-d 00:00:00'),
            AggregatePeriod::Year => $date->copy()->startOfMonth()->startOfDay()->format('Y-m-01 00:00:00'),
        };
    }
}
