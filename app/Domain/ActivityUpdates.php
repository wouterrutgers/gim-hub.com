<?php

namespace App\Domain;

use App\Models\ActivityEntry;
use App\Models\ActivityReceipt;
use App\Models\Member;
use Illuminate\Validation\ValidationException;

class ActivityUpdates
{
    public const array TYPES = ['xp', 'level', 'boss', 'quest', 'diary', 'loot'];

    public const array SKILLS = ['Agility', 'Attack', 'Construction', 'Cooking', 'Crafting', 'Defence', 'Farming', 'Firemaking', 'Fishing', 'Fletching', 'Herblore', 'Hitpoints', 'Hunter', 'Magic', 'Mining', 'Prayer', 'Ranged', 'Runecraft', 'Slayer', 'Smithing', 'Strength', 'Thieving', 'Woodcutting', 'Sailing'];

    protected static ?array $diaryTasks = null;

    public static function rules(array $input): array
    {
        $rules = [
            'activity_updates' => ['sometimes', 'array', 'list', ['max', 100]],
            'activity_updates.*' => ['required', ['array', 'id', 'revision', 'type', 'started_at', 'occurred_at', 'data']],
            'activity_updates.*.id' => ['required', 'uuid', 'distinct'],
            'activity_updates.*.revision' => ['required', 'integer', ['min', 1], ['max', 2147483647]],
            'activity_updates.*.type' => ['required', ['in', ...static::TYPES]],
            'activity_updates.*.started_at' => ['required', 'integer', ['min', 1], ['max', now()->addMinutes(5)->getTimestampMs()]],
            'activity_updates.*.occurred_at' => ['required', 'integer', ['min', 1], ['max', now()->addMinutes(5)->getTimestampMs()]],
        ];

        foreach (is_array($input['activity_updates'] ?? null) ? $input['activity_updates'] : [] as $index => $update) {
            $attribute = "activity_updates.{$index}.data";
            $fields = match ($update['type'] ?? '') {
                'xp' => ['skills'],
                'level' => ['skill', 'before', 'after'],
                'boss' => ['boss', 'count_type', 'count', 'total_count'],
                'quest' => ['quest_id', 'quest_name'],
                'diary' => ['before', 'after'],
                'loot' => ['item_id', 'quantity', 'value', 'source', 'new_collection_item'],
                default => [],
            };
            $rules[$attribute] = ['required', ['array', ...$fields]];
            foreach ($fields as $field) {
                $rules["{$attribute}.{$field}"] = ['required'];
            }
            foreach (['skill', 'boss', 'quest_name', 'source'] as $field) {
                if (in_array($field, $fields)) {
                    $rules["{$attribute}.{$field}"] = ['required', 'string', ['max', 200]];
                }
            }
            foreach (['item_id', 'quest_id', 'quantity', 'count', 'total_count'] as $field) {
                if (in_array($field, $fields)) {
                    $rules["{$attribute}.{$field}"] = ['required', 'integer', ['min', $field === 'quest_id' ? 0 : 1], ['max', 2147483647]];
                }
            }
            if (($update['type'] ?? '') === 'xp') {
                $rules["{$attribute}.skills"] = ['required', ['array', ...static::SKILLS], ['min', 1]];
                $rules["{$attribute}.skills.*"] = ['required', 'integer', ['min', 1], ['max', 200000000]];
            }
            if (($update['type'] ?? '') === 'boss') {
                $rules["{$attribute}.count_type"] = ['required', ['in', 'kill', 'chest', 'completion']];
            }
            if (($update['type'] ?? '') === 'level') {
                $rules["{$attribute}.skill"] = ['required', ['in', ...static::SKILLS]];
                $rules["{$attribute}.before"] = ['required', 'integer', ['min', 1], ['max', 98]];
                $rules["{$attribute}.after"] = ['required', 'integer', ['min', 2], ['max', 99], ['gt', "{$attribute}.before"]];
            }
            if (($update['type'] ?? '') === 'diary') {
                foreach (['before', 'after'] as $field) {
                    $rules["{$attribute}.{$field}"] = ['required', 'array', 'list', ['size', 62]];
                    $rules["{$attribute}.{$field}.*"] = ['integer', ['min', -2147483648], ['max', 2147483647]];
                }
            }
            if (($update['type'] ?? '') === 'loot') {
                $rules["{$attribute}.value"] = ['required', 'integer', ['min', 0], ['max', 9007199254740991]];
                $rules["{$attribute}.new_collection_item"] = ['required', 'boolean'];
            }
            $rules["activity_updates.{$index}.occurred_at"][] = ['gte', "activity_updates.{$index}.started_at"];
        }

        return $rules;
    }

    public static function apply(Member $member, array $updates): void
    {
        foreach ($updates as $update) {
            if ($update['occurred_at'] < now()->subDays(30)->getTimestampMs()) {
                continue;
            }
            if ($update['type'] === 'diary') {
                static::diaries($member, $update);

                continue;
            }
            if ($update['type'] === 'loot') {
                static::loot($member, $update);

                continue;
            }
            static::store($member, $update);
        }
    }

    protected static function store(Member $member, array $update, string $subject = ''): void
    {
        $entry = ActivityEntry::firstOrNew(['member_id' => $member->id, 'source_id' => $update['id'], 'subject' => $subject]);
        if ($entry->exists && $entry->revision >= $update['revision']) {
            return;
        }
        if ($entry->exists && ($entry->type !== $update['type'] || $entry->started_at !== $update['started_at'] || $entry->occurred_at > $update['occurred_at'])) {
            throw ValidationException::withMessages(['activity_updates' => 'Activity updates must preserve their original type and start time.']);
        }
        if ($entry->exists && $update['type'] === 'xp' && array_any($entry->data['skills'], fn (int $quantity, string $skill): bool => ($update['data']['skills'][$skill] ?? 0) < $quantity)) {
            throw ValidationException::withMessages(['activity_updates' => 'Cumulative experience cannot decrease.']);
        }
        $entry->fill([
            'group_id' => $member->group_id,
            'revision' => $update['revision'],
            'type' => $update['type'],
            'started_at' => $update['started_at'],
            'occurred_at' => $update['occurred_at'],
            'data' => $update['data'],
        ])->save();
    }

    protected static function loot(Member $member, array $update): void
    {
        if (ActivityReceipt::where('member_id', '=', $member->id)->where('source_id', '=', $update['id'])->exists()) {
            return;
        }
        if (ActivityEntry::where('member_id', '=', $member->id)->where('source_id', '=', $update['id'])->exists()) {
            static::store($member, $update);

            return;
        }
        if ($update['data']['new_collection_item'] || $update['data']['value'] >= 1_000_000) {
            static::store($member, $update);

            return;
        }
        if (! CollectionLogUpdates::contains($update['data']['item_id'])) {
            return;
        }
        $entry = ActivityEntry::where('member_id', '=', $member->id)
            ->where('type', '=', 'collection')
            ->where('data->item_id', '=', $update['data']['item_id'])
            ->where('occurred_at', '>=', $update['occurred_at'] - 15 * 60 * 1000)
            ->where('occurred_at', '<=', $update['occurred_at'])
            ->orderByDesc('occurred_at')->first();
        if (is_null($entry)) {
            $entry = ActivityEntry::create([
                'group_id' => $member->group_id, 'member_id' => $member->id,
                'source_id' => $update['id'], 'revision' => 1, 'type' => 'collection',
                'started_at' => $update['started_at'], 'occurred_at' => $update['occurred_at'], 'data' => $update['data'],
            ]);
        } else {
            $entry->update([
                'revision' => $entry->revision + 1, 'occurred_at' => $update['occurred_at'],
                'data' => [...$entry->data, 'quantity' => $entry->data['quantity'] + $update['data']['quantity'], 'value' => $entry->data['value'] + $update['data']['value']],
            ]);
        }
        ActivityReceipt::create(['member_id' => $member->id, 'source_id' => $update['id'], 'activity_entry_id' => $entry->id]);
    }

    protected static function diaries(Member $member, array $update): void
    {
        static::$diaryTasks ??= 'game/diary-tasks.json'
                |> resource_path(...)
                |> file_get_contents(...)
                |> (fn ($x) => json_decode($x, associative: true, flags: JSON_THROW_ON_ERROR));
        foreach (static::$diaryTasks as $region => $tiers) {
            foreach ($tiers as $tier => $tasks) {
                $gained = [];
                $complete = true;
                foreach ($tasks as $index => $bits) {
                    $before = static::diaryTaskComplete($update['data']['before'], $bits);
                    $after = static::diaryTaskComplete($update['data']['after'], $bits);
                    if ($after && ! $before) {
                        $gained[] = $index;
                    }
                    $complete = $complete && $after;
                }
                if ($gained === []) {
                    continue;
                }
                static::store($member, [...$update, 'data' => ['region' => $region, 'tier' => $tier, 'tasks' => $gained, 'complete' => $complete]], "{$region}:{$tier}");
            }
        }
    }

    protected static function diaryTaskComplete(array $values, array $task): bool
    {
        if (isset($task['value'])) {
            return $values[$task['value'][0]] === $task['value'][1];
        }

        return array_any($task['bits'], fn (array $bit): bool => ($values[$bit[0]] & (1 << $bit[1])) !== 0);
    }
}
