<?php

namespace App\Console\Commands;

use App\Models\Group;
use Carbon\Carbon;
use Illuminate\Console\Command;

class PurgeExpiredChatMessages extends Command
{
    protected $signature = 'chat:purge';

    protected $description = 'Delete chat messages older than the configured retention period';

    public function handle(): int
    {
        $backendMax = (int) env('CHAT_RETENTION_DAYS', 7);
        $backendMax = max(1, min(7, $backendMax));

        Group::each(function (Group $group) use ($backendMax): void {
            $groupRetention = $group->chat_retention_days ?? 7;
            $effectiveDays = max(1, min((int) $groupRetention, $backendMax));
            $cutoff = Carbon::now()->subDays($effectiveDays);

            $group->chatMessages()->where('sent_at', '<', $cutoff)->delete();
        });

        $this->info('Expired chat messages purged successfully.');

        return static::SUCCESS;
    }
}
