<?php

namespace App\Http\Controllers;

use App\Models\ActivityEntry;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

class GroupActivityController extends Controller
{
    public function player(): JsonResponse
    {
        $group = request()->attributes->get('group');
        $member = $group->members()->whereKey(request()->route('member'))->firstOrFail();
        $validated = request()->validate([
            'timezone' => ['required', 'timezone'],
            'cursor' => ['sometimes', 'string', ['regex', '/^(day|week):[1-9][0-9]{0,12}$/']],
            'from_time' => ['sometimes', 'date'],
        ]);
        $watermark = CarbonImmutable::now();
        $query = ActivityEntry::where('group_id', '=', $group->id)->where('member_id', '=', $member->id);
        $candidates = (clone $query)->where('updated_at', '<=', $watermark->format('Y-m-d H:i:s.v'));
        $cursor = isset($validated['cursor']) ? explode(':', $validated['cursor']) : null;

        if (isset($validated['from_time'])) {
            $candidates->where('updated_at', '>=', CarbonImmutable::parse($validated['from_time'])->subMinute()->format('Y-m-d H:i:s.v'));
        } elseif (! is_null($cursor)) {
            $candidates->where('started_at', '<', CarbonImmutable::createFromTimestampMs($cursor[1])->addWeek()->getTimestampMs());
        }

        $periods = collect();

        foreach ($candidates->select(['id', 'started_at', 'is_weekly'])->orderByDesc('started_at')->orderByDesc('id')->lazy(500) as $entry) {
            $period = $this->period($entry, $validated['timezone']);

            if (! isset($validated['from_time']) && ! is_null($cursor) &&
                ($period['started_at'] > $cursor[1] || ($period['started_at'] === intval($cursor[1]) && strcmp($period['kind'], $cursor[0]) >= 0))) {
                continue;
            }

            if (! isset($validated['from_time']) && $periods->count() > 7 && $entry->started_at < $periods->min('started_at')) {
                break;
            }

            $periods->put($period['key'], $period);
        }

        $periods = $periods->sort(function (array $left, array $right): int {
            return $right['started_at'] <=> $left['started_at'] ?: strcmp($right['kind'], $left['kind']);
        })->values();
        $olderCursor = null;

        if (! isset($validated['from_time']) && $periods->count() > 7) {
            $periods = $periods->take(7);
            $olderCursor = $periods->last()['key'];
        }

        $entries = $periods->isEmpty() ? collect() : $query->where(function (Builder $query) use ($periods): void {
            foreach ($periods as $period) {
                $query->orWhere(function (Builder $query) use ($period): void {
                    $query->where('is_weekly', '=', $period['kind'] === 'week')
                        ->where('started_at', '>=', $period['started_at'])->where('started_at', '<', $period['ended_at']);
                });
            }
        })->orderByDesc('started_at')->orderByDesc('id')->get();
        $byPeriod = $entries->groupBy(fn (ActivityEntry $entry): string => $this->period($entry, $validated['timezone'])['key']);
        $response = [
            'periods' => $periods->map(fn (array $period): array => [...$period, 'entries' => $this->entries($byPeriod->get($period['key'], collect()))])->all(),
            'from_time' => $watermark->toISOString(),
        ];

        if (! isset($validated['from_time'])) {
            $response['older_cursor'] = $olderCursor;
        }

        return response()->json($response);
    }

    /**
     * @return array{key: string, kind: 'day'|'week', started_at: int, ended_at: int}
     */
    protected function period(ActivityEntry $entry, string $timezone): array
    {
        $start = CarbonImmutable::createFromTimestampMs($entry->started_at, $entry->is_weekly ? 'UTC' : $timezone)->startOfDay();
        $kind = $entry->is_weekly ? 'week' : 'day';

        return [
            'key' => "{$kind}:{$start->getTimestampMs()}",
            'kind' => $kind,
            'started_at' => $start->getTimestampMs(),
            'ended_at' => ($entry->is_weekly ? $start->addWeek() : $start->addDay())->getTimestampMs(),
        ];
    }

    public function index(): JsonResponse
    {
        $validated = request()->validate([
            'from_time' => ['sometimes', 'date'],
            'cursor' => ['sometimes', 'string', ['max', 1000]],
        ]);
        $group = request()->attributes->get('group');
        $watermark = CarbonImmutable::now();
        $query = ActivityEntry::where('group_id', '=', $group->id)
            ->where('updated_at', '<=', $watermark->format('Y-m-d H:i:s.v'));

        if (isset($validated['from_time'])) {
            $entries = $query->where('updated_at', '>=', CarbonImmutable::parse($validated['from_time'])->subMinute()->format('Y-m-d H:i:s.v'))
                ->orderByDesc('updated_at')->orderByDesc('id')->get();

            return response()->json([
                'entries' => $this->entries($entries), 'from_time' => $watermark->toISOString(),
            ]);
        }

        $page = $query->orderByDesc('started_at')->orderByDesc('id')->cursorPaginate(50);

        return response()->json([
            'entries' => $this->entries($page->getCollection()),
            'older_cursor' => $page->nextCursor()?->encode(),
            'from_time' => $watermark->toISOString(),
        ]);
    }

    protected function entries(Collection $entries): array
    {
        return $entries->map(fn (ActivityEntry $entry): array => [
            'id' => $entry->id,
            'member_id' => $entry->member_id,
            'revision' => $entry->revision,
            'type' => $entry->type,
            'started_at' => $entry->started_at,
            'occurred_at' => $entry->occurred_at,
            'is_weekly' => $entry->is_weekly,
            'data' => $entry->data,
        ])->all();
    }
}
