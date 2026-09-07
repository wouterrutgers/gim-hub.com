<?php

namespace App\Console\Commands;

use App\Enums\AggregatePeriod;
use App\Models\AggregationInfo;
use App\Models\SkillStat;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ApplySkillsRetention extends Command
{
    protected $signature = 'skills:retention';

    protected $description = 'Apply retention policy to skills data';

    public function handle(): int
    {
        DB::transaction(function (): void {
            $lastAggregation = AggregationInfo::where('type', '=', 'skills')->value('updated_at');

            if (is_null($lastAggregation)) {
                return;
            }

            foreach (AggregatePeriod::cases() as $period) {
                $cutoff = $period->cutoff(Carbon::parse($lastAggregation));

                if (is_null($cutoff)) {
                    continue;
                }

                $baselines = SkillStat::where('type', '=', $period->value)
                    ->where('created_at', '<', $cutoff)
                    ->selectRaw('member_id, max(created_at) as baseline')
                    ->groupBy('member_id')
                    ->get();

                foreach ($baselines as $baseline) {
                    SkillStat::where('member_id', '=', $baseline->member_id)
                        ->where('type', '=', $period->value)
                        ->where('created_at', '<', $baseline->baseline)
                        ->delete();
                }
            }
        });

        $this->info('Skills retention applied successfully.');

        return static::SUCCESS;
    }
}
