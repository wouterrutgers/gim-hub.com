<?php

namespace App\Console\Commands;

use App\Jobs\SyncMemberSkillsFromHiscores;
use App\Models\Member;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;

class SyncStaleMembersFromHiscores extends Command
{
    protected $signature = 'hiscores:sync-stale-members';

    protected $description = 'Queue hiscores sync jobs for members with no recent updates';

    public function handle(): int
    {
        $staleMembers = Member::where('name', '!=', Member::SHARED_MEMBER)
            ->withMax('properties', 'updated_at')
            ->get()
            ->filter(function (Member $member) {
                if (! $member->properties_max_updated_at) {
                    return false;
                }

                return CarbonImmutable::make($member->properties_max_updated_at) < now()->subHours(4);
            })
            ->values();

        $dispatchTime = now();
        $staleMembers->each(function (Member $member, int $index) use ($dispatchTime) {
            $dispatch = SyncMemberSkillsFromHiscores::dispatch($member->id);

            if ($index > 0) {
                $dispatch->delay($dispatchTime->addSeconds($index * 2));
            }
        });

        $this->info("Dispatched {$staleMembers->count()} hiscores sync job(s).");

        return static::SUCCESS;
    }
}
