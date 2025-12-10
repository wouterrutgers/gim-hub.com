<?php

namespace App\Console\Commands;

use App\Models\Group;
use App\Models\Member;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Builder;

class ActiveGroups extends Command
{
    protected $signature = 'groups:active {--sort-by-created-at : Sort by group creation date}';

    protected $description = 'Find active groups';

    public function handle(): void
    {
        $groups = Group::with(['members' => function ($query) {
            $query->where('name', '!=', '@SHARED')->with('properties');
        }])->whereHas('members', function (Builder $query) {
            $query->where('name', '!=', '@SHARED')->whereHas('properties', function (Builder $query) {
                $query->where('last_update', '>=', now()->subDays(30));
            });
        })->get();

        $groups = $groups->sortByDesc(function (Group $group) {
            if ($this->option('sort-by-created-at')) {
                return $group->created_at;
            }

            return $group->members->flatMap(function (Member $member) {
                return $member->properties->pluck('last_update');
            })->max();
        });

        $sortMethod = $this->option('sort-by-created-at') ? 'creation date' : 'last activity';
        $this->info("Active groups (sorted by {$sortMethod})");
        $this->newLine();

        foreach ($groups->values() as $index => $group) {
            $latestDate = $group->members->flatMap(function (Member $member) {
                return $member->properties->pluck('last_update');
            })->max();

            $lastActive = $latestDate ? $latestDate->diffForHumans() : 'never';
            $isLast = $index === $groups->count() - 1;

            $info = $lastActive;
            if ($this->option('sort-by-created-at')) {
                $info = $group->created_at->format('Y-m-d H:i');
            }

            $this->info("{$group->name} <comment>({$info})</comment>");

            $sortedMembers = $group->members->sortByDesc(function (Member $member) {
                return $member->properties->max('last_update');
            })->values();

            foreach ($sortedMembers as $memberIndex => $member) {
                $memberLatestDate = $member->properties->max('last_update');

                $lastUpdate = $memberLatestDate ? $memberLatestDate->diffForHumans() : 'never';
                $isLastMember = $memberIndex === $sortedMembers->count() - 1;
                $memberPrefix = $isLastMember ? '└── ' : '├── ';

                $this->line("{$memberPrefix}{$member->name} <comment>({$lastUpdate})</comment>");
            }

            if (! $isLast) {
                $this->newLine();
            }
        }

        $this->newLine();
        $this->info("Total: {$groups->count()} groups");
    }
}
