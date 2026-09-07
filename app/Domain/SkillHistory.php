<?php

namespace App\Domain;

use App\Enums\AggregatePeriod;
use App\Models\Group;
use App\Models\Member;
use App\Models\SkillStat;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

class SkillHistory
{
    protected const int DISPLAY_SAMPLES = 1500;

    /**
     * @return array{start: string, end: string, earliest: ?string, members: list<array{name: string, skill_data: list<array{time: string, data: list<int>}>}>}
     */
    public function get(Group $group, ?CarbonImmutable $start, CarbonImmutable $end): array
    {
        $members = $group->members()->where('name', '!=', Member::SHARED_MEMBER)->get();
        $firstSamples = SkillStat::whereIn('member_id', $members->modelKeys())
            ->selectRaw('member_id, type, min(created_at) as first_sample')
            ->groupBy('member_id', 'type')
            ->get();
        $earliest = $firstSamples->min('first_sample');
        $start ??= is_null($earliest) ? $end->subDay() : min(CarbonImmutable::parse($earliest), $end->subMinutes(5));

        return [
            'start' => $start->toIso8601ZuluString(),
            'end' => $end->toIso8601ZuluString(),
            'earliest' => is_null($earliest) ? null : CarbonImmutable::parse($earliest)->toIso8601ZuluString(),
            'members' => $members->map(fn (Member $member): array => [
                'name' => $member->name,
                'skill_data' => $this->samples($member, $firstSamples->where('member_id', '=', $member->id), $start, $end),
            ])->all(),
        ];
    }

    /**
     * @param  Collection<int, SkillStat>  $firstSamples
     * @return list<array{time: string, data: list<int>}>
     */
    protected function samples(Member $member, Collection $firstSamples, CarbonImmutable $start, CarbonImmutable $end): array
    {
        $firstSamples = $firstSamples->pluck('first_sample', 'type');
        $bucketSeconds = max(1, (int) ceil(($end->getTimestamp() - $start->getTimestamp()) / static::DISPLAY_SAMPLES));
        $buckets = [];
        $baseline = null;
        $first = null;
        $finerStart = null;

        foreach (AggregatePeriod::cases() as $period) {
            if (! $firstSamples->has($period->value)) {
                continue;
            }

            $query = SkillStat::where('member_id', '=', $member->id)
                ->where('type', '=', $period->value)
                ->where('created_at', '<=', $end);

            if (! is_null($finerStart)) {
                $query->where('created_at', '<', $period->bucketStart($finerStart));
            }

            $previous = (clone $query)->where('created_at', '<=', $start)->orderByDesc('created_at')->orderByDesc('id')->first();
            if (! is_null($previous) && (is_null($baseline) || $previous->created_at > $baseline->created_at)) {
                $baseline = $previous;
            }

            foreach ((clone $query)->where('created_at', '>', $start)->orderBy('created_at')->orderBy('id')->cursor() as $sample) {
                if (is_null($first) || $sample->created_at < $first->created_at) {
                    $first = $sample;
                }

                $bucket = intdiv($sample->created_at->getTimestamp() - $start->getTimestamp() - 1, $bucketSeconds);
                if (! isset($buckets[$bucket]) || $sample->created_at >= $buckets[$bucket]->created_at) {
                    $buckets[$bucket] = $sample;
                }
            }

            $periodStart = CarbonImmutable::parse($firstSamples[$period->value]);
            $finerStart = is_null($finerStart) ? $periodStart : min($finerStart, $periodStart);
        }

        return collect([$baseline, $first, ...array_values($buckets)])
            ->filter()
            ->unique('id')
            ->sortBy('created_at')
            ->map(fn (SkillStat $sample): array => [
                'time' => $sample->created_at->toIso8601ZuluString(),
                'data' => $sample->skills,
            ])
            ->values()
            ->all();
    }
}
