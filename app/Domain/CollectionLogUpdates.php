<?php

namespace App\Domain;

use App\Models\Member;

class CollectionLogUpdates
{
    protected static ?array $aliases = null;

    protected static ?array $items = null;

    public static function apply(Member $member, array $updates): void
    {
        $aliases = static::aliases();
        $normalized = [];
        $identifiers = [];

        foreach ($updates as $update) {
            $quantities = [];

            foreach ($update['items'] as $item) {
                $identifier = $aliases[$item['item_id']] ?? $item['item_id'];

                if ($update['type'] === 'drop' && ! isset(static::items()[$identifier])) {
                    continue;
                }

                $quantities[$identifier] = $update['type'] === 'drop'
                    ? ($quantities[$identifier] ?? 0) + $item['quantity']
                    : max($quantities[$identifier] ?? 0, $item['quantity']);
                $identifiers[$identifier] = true;
            }

            $normalized[] = ['type' => $update['type'], 'quantities' => $quantities];
        }

        if ($identifiers === []) {
            return;
        }

        $aliasIdentifiers = $identifiers
                |> array_keys(...)
                |> (fn ($x) => array_intersect($aliases, $x))
                |> array_keys(...);
        $stored = $member->collectionLogs()
            ->whereIn('item_id', [...array_keys($identifiers), ...$aliasIdentifiers])
            ->pluck('item_count', 'item_id')->all();
        $counts = [];

        foreach ($stored as $identifier => $quantity) {
            $identifier = $aliases[$identifier] ?? $identifier;
            $counts[$identifier] = max($counts[$identifier] ?? 0, $quantity);
        }

        foreach ($normalized as $update) {
            foreach ($update['quantities'] as $identifier => $quantity) {
                $counts[$identifier] = match ($update['type']) {
                    'drop' => ($counts[$identifier] ?? 0) + $quantity,
                    'unlock' => max($counts[$identifier] ?? 0, 1),
                    'scan' => $quantity,
                };
            }
        }

        $obsolete = array_intersect($aliasIdentifiers, array_keys($stored));

        if ($obsolete !== []) {
            $member->collectionLogs()->whereIn('item_id', $obsolete)->delete();
        }

        $rows = [];

        foreach ($counts as $identifier => $quantity) {
            if (isset($stored[$identifier]) && $stored[$identifier] === $quantity) {
                continue;
            }

            $rows[] = ['item_id' => $identifier, 'item_count' => $quantity];
        }

        if ($rows !== []) {
            $member->collectionLogs()->upsert($rows, ['member_id', 'item_id'], ['item_count', 'updated_at']);
        }
    }

    protected static function aliases(): array
    {
        return static::$aliases ??= 'game/collection-log-item-aliases.json'
                |> resource_path(...)
                |> file_get_contents(...)
                |> (fn ($x) => json_decode($x, associative: true, flags: JSON_THROW_ON_ERROR));
    }

    protected static function items(): array
    {
        return static::$items ??= ('assets/data/collection_log_info.json'
            |> resource_path(...)
            |> file_get_contents(...)
            |> (fn ($x) => json_decode($x, associative: true, flags: JSON_THROW_ON_ERROR))
            |> collect(...))
            ->pluck('pages')->flatten(1)->pluck('items')->flatten(1)->pluck('id')
            ->mapWithKeys(fn (int $identifier): array => [static::aliases()[$identifier] ?? $identifier => true])->all();
    }
}
