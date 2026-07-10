<?php

namespace App\Console\Commands;

use App\Jobs\CreateMemberSnapshot;
use App\Models\Member;
use App\Models\MemberSnapshot;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Builder;

class CreateMemberSnapshots extends Command
{
    protected $signature = 'member-snapshots:create';

    protected $description = 'Create periodic snapshots for member activity';

    protected const int SNAPSHOT_RETENTION_DAYS = 7;

    public function handle(): int
    {
        MemberSnapshot::where('created_at', '<', now()->subDays(static::SNAPSHOT_RETENTION_DAYS))->delete();

        $dispatchTime = now()->toImmutable();
        $dispatched = 0;

        $members = Member::where('name', '!=', Member::SHARED_MEMBER)
            ->whereHas('properties', function (Builder $query): void {
                $query->where('key', '=', 'skills');
            })
            ->whereHas('properties', function (Builder $query): void {
                $query->where('updated_at', '>=', now()->subWeeks(2));
            })
            ->select('id')
            ->lazyById(100);

        foreach ($members as $member) {
            $dispatch = CreateMemberSnapshot::dispatch($member->id);

            if ($dispatched > 0) {
                $dispatch->delay($dispatchTime->addSeconds($dispatched * 2));
            }

            $dispatched++;
        }

        $this->info("Dispatched {$dispatched} member snapshot job(s).");

        return static::SUCCESS;
    }
}
