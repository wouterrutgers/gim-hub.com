<?php

namespace App\Console\Commands;

use App\Models\Group;
use App\Models\Member;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Builder;

class ActiveGroups extends Command
{
    protected $signature = 'groups:active';

    protected $description = 'Find active groups';

    public function handle(): void
    {
        $groups = Group::with(['members' => function ($query) {
            $query->where('name', '!=', '@SHARED');
        }])->whereHas('members', function (Builder $query) {
            $query->where('name', '!=', '@SHARED')->where(function (Builder $query) {
                foreach ($this->dates() as $date) {
                    $query->orWhere($date, '>=', now()->subDays(30));
                }
            });
        })->get();

        $groups = $groups->sortByDesc(function (Group $group) {
            return $group->members->flatMap(function (Member $member) {
                return collect($this->dates())->map(fn (string $date) => $member->{$date})->filter();
            })->max();
        });

        $this->info('Active groups (sorted by last activity)');
        $this->newLine();

        foreach ($groups->values() as $index => $group) {
            $latestDate = $group->members->flatMap(function (Member $member) {
                return collect($this->dates())->map(fn (string $date) => $member->{$date})->filter();
            })->max();

            $lastActive = $latestDate ? $latestDate->diffForHumans() : 'never';
            $isLast = $index === $groups->count() - 1;

            $this->info("{$group->name} <comment>({$lastActive})</comment>");

            $sortedMembers = $group->members->sortByDesc(function (Member $member) {
                return collect($this->dates())->map(fn (string $date) => $member->{$date})->filter()->max();
            })->values();

            foreach ($sortedMembers as $memberIndex => $member) {
                $memberLatestDate = collect($this->dates())->map(fn (string $date) => $member->{$date})->filter()->max();

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

    protected function dates(): array
    {
        return [
            'stats_last_update',
            'coordinates_last_update',
            'skills_last_update',
            'quests_last_update',
            'inventory_last_update',
            'equipment_last_update',
            'bank_last_update',
            'rune_pouch_last_update',
            'interacting_last_update',
            'seed_vault_last_update',
            'poh_wardrobe_last_update',
            'quiver_last_update',
            'diary_vars_last_update',
        ];
    }
}
