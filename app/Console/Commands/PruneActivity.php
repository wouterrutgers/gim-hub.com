<?php

namespace App\Console\Commands;

use App\Models\ActivityEntry;
use App\Models\ActivityReceipt;
use App\Models\Member;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PruneActivity extends Command
{
    protected $signature = 'activity:prune';

    protected $description = 'Combine group activity older than 30 days into weekly summaries';

    public function handle(): int
    {
        $cutoff = CarbonImmutable::now()->subDays(30)->startOfWeek(CarbonInterface::MONDAY)->getTimestampMs();

        Member::whereIn('id', ActivityEntry::select('member_id')->where('is_weekly', '=', value: false)->where('occurred_at', '<', $cutoff))
            ->eachById(function (Member $member) use ($cutoff): void {
                DB::transaction(function () use ($member, $cutoff): void {
                    Member::whereKey($member->id)->lockForUpdate()->firstOrFail();
                    $entries = ActivityEntry::where('member_id', '=', $member->id)
                        ->where('is_weekly', '=', value: false)->where('occurred_at', '<', $cutoff)
                        ->orderBy('occurred_at')->orderBy('id')->get();

                    foreach ($entries->groupBy(fn (ActivityEntry $entry): string => $this->bucket($entry)) as $activities) {
                        $first = $activities->first();
                        $data = $first->data;

                        foreach ($activities->skip(1) as $entry) {
                            $data = $this->combine($first->type, $data, $entry->data);
                        }

                        ActivityEntry::create([
                            'group_id' => $member->group_id,
                            'member_id' => $member->id,
                            'source_id' => Str::uuid()->toString(), 'revision' => 1, 'type' => $first->type,
                            'started_at' => CarbonImmutable::createFromTimestampMs($first->occurred_at)->startOfWeek(CarbonInterface::MONDAY)->getTimestampMs(),
                            'occurred_at' => $activities->max('occurred_at'),
                            'is_weekly' => true, 'data' => $data,
                        ]);
                    }

                    ActivityEntry::whereIn('id', $entries->modelKeys())->delete();
                });
            });

        ActivityReceipt::where('created_at', '<', now()->subDays(30))->delete();

        return static::SUCCESS;
    }

    protected function bucket(ActivityEntry $entry): string
    {
        return json_encode([
            CarbonImmutable::createFromTimestampMs($entry->occurred_at)->startOfWeek(CarbonInterface::MONDAY)->getTimestampMs(),
            $entry->type,
            match ($entry->type) {
                'xp' => '',
                'level' => $entry->data['skill'],
                'boss' => [$entry->data['boss'], $entry->data['count_type']],
                'quest' => $entry->data['quest_id'],
                'diary' => [$entry->data['region'], $entry->data['tier']],
                'loot',
                'collection' => [$entry->data['item_id'], $entry->data['source']],
            },
        ], JSON_THROW_ON_ERROR);
    }

    protected function combine(string $type, array $total, array $data): array
    {
        if ($type === 'xp') {
            foreach ($data['skills'] as $skill => $quantity) {
                $total['skills'][$skill] = ($total['skills'][$skill] ?? 0) + $quantity;
            }

            return $total;
        }

        return match ($type) {
            'level' => [...$total, 'before' => min($total['before'], $data['before']), 'after' => max($total['after'], $data['after'])],
            'boss' => [...$total, 'count' => $total['count'] + $data['count'], 'total_count' => max($total['total_count'], $data['total_count'])],
            'quest' => $total,
            'diary' => [...$total, 'tasks' => array_values(array_unique([...$total['tasks'], ...$data['tasks']])), 'complete' => $total['complete'] || $data['complete']],
            'loot',
            'collection' => [...$total, 'quantity' => $total['quantity'] + $data['quantity'], 'value' => $total['value'] + $data['value'], 'new_collection_item' => $total['new_collection_item'] || $data['new_collection_item']],
        };
    }
}
