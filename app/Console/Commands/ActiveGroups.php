<?php

namespace App\Console\Commands;

use App\Models\Group;
use App\Models\Member;
use Carbon\CarbonInterface;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ActiveGroups extends Command
{
    protected $signature = 'groups:active {--sort-by-created-at : Sort by group creation date}';

    protected $description = 'Find active groups';

    public function handle(): void
    {
        $activeGroups = Group::with(['members' => function (HasMany $query): void {
            $query->select(['id', 'group_id'])
                ->where('name', '!=', Member::SHARED_MEMBER)
                ->with(['properties' => function (HasMany $query): void {
                    $query->select(['id', 'member_id', 'updated_at']);
                }]);
        }])->whereHas('members', function (Builder $query): void {
            $query->where('name', '!=', Member::SHARED_MEMBER)
                ->whereHas('properties', function (Builder $query): void {
                    $query->where('updated_at', '>=', now()->subDays(30));
                });
        })->get()->map(function (Group $group): array {
            return [
                'group' => $group,
                'lastActivityAt' => $group->members->pluck('properties')->flatten()->max('updated_at'),
            ];
        })->sortByDesc(function (array $activeGroup): CarbonInterface {
            return $this->option('sort-by-created-at')
                ? $activeGroup['group']->created_at
                : $activeGroup['lastActivityAt'];
        });

        $sortMethod = $this->option('sort-by-created-at') ? 'creation date' : 'last activity';
        $this->info("Active groups (sorted by {$sortMethod})");
        $this->newLine();

        $this->table(
            ['Group', 'Members', 'Last activity', 'Created'],
            $activeGroups->map(function (array $activeGroup): array {
                return [
                    $activeGroup['group']->name,
                    $activeGroup['group']->members->count(),
                    $activeGroup['lastActivityAt']->diffForHumans(),
                    $activeGroup['group']->created_at->format('Y-m-d H:i'),
                ];
            })->values()->all(),
        );

        $this->newLine();
        $this->info("Total: {$activeGroups->count()} groups");
    }
}
