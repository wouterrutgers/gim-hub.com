<?php

namespace App\Console\Commands;

use App\Models\ActivityEntry;
use App\Models\ActivityReceipt;
use Illuminate\Console\Command;

class PruneActivity extends Command
{
    protected $signature = 'activity:prune';

    protected $description = 'Remove group activity older than 30 days';

    public function handle(): int
    {
        ActivityEntry::where('occurred_at', '<', now()->subDays(30)->getTimestampMs())->delete();
        ActivityReceipt::where('created_at', '<', now()->subDays(30))->delete();

        return static::SUCCESS;
    }
}
