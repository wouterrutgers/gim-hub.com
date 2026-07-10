<?php

namespace App\Jobs;

use App\Domain\MemberSnapshotCreator;
use App\Models\Member;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class CreateMemberSnapshot implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 30;

    public function __construct(protected int $memberId) {}

    public function handle(MemberSnapshotCreator $creator): void
    {
        $member = Member::where('id', '=', $this->memberId)->first();

        if (! $member) {
            return;
        }

        $creator->create($member);
    }

    public function uniqueId(): string
    {
        return (string) $this->memberId;
    }

    public function backoff(): array
    {
        return [60, 300];
    }
}
