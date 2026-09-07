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
        DB::transaction(function (): void {
            $aggregationTime = now();
            $lastAggregation = AggregationInfo::where('type', '=', 'skills')->value('updated_at');

            $properties = MemberProperty::where('key', '=', 'skills')
                ->where('updated_at', '>=', is_null($lastAggregation) ? Carbon::createFromTimestamp(0) : $lastAggregation)
                ->where('updated_at', '<=', $aggregationTime)
                ->lazyById();

            foreach ($properties as $property) {
                foreach ([AggregatePeriod::FiveMinutes, AggregatePeriod::Hourly, AggregatePeriod::Monthly] as $period) {
                    SkillStat::updateOrCreate(
                        [
                            'member_id' => $property->member_id,
                            'type' => $period->value,
                            'created_at' => $period->bucketStart($property->updated_at),
                        ],
                        ['skills' => $property->value, 'updated_at' => $aggregationTime],
                    );
                }
            }

            AggregationInfo::updateOrCreate(['type' => 'skills'], ['updated_at' => $aggregationTime]);
        });

        $this->info('Skills data aggregated successfully.');

        return static::SUCCESS;
    }
}
