<?php

namespace App\Http\Controllers;

use App\Models\ActivityEntry;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

class GroupActivityController extends Controller
{
    public function index(): JsonResponse
    {
        $validated = request()->validate([
            'from_time' => ['sometimes', 'date'],
            'cursor' => ['sometimes', 'string', ['max', 1000]],
        ]);
        $group = request()->attributes->get('group');
        $watermark = CarbonImmutable::now();
        $query = ActivityEntry::where('group_id', '=', $group->id)
            ->where('occurred_at', '>=', $watermark->subDays(30)->getTimestampMs())
            ->where('updated_at', '<=', $watermark->format('Y-m-d H:i:s.v'));

        if (isset($validated['from_time'])) {
            $entries = $query->where('updated_at', '>=', CarbonImmutable::parse($validated['from_time'])->format('Y-m-d H:i:s.v'))
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
            'data' => $entry->data,
        ])->all();
    }
}
