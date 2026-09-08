<?php

namespace App\Domain;

use App\Models\Member;

class CollectionLogUpdates
{
    /**
     * @param  array<int, array{type: string, items: array<int, array{item_id: int, quantity: int}>}>  $updates
     */
    public static function apply(Member $member, array $updates): void
    {
        $aliases = 'game/collection-log-item-aliases.json'
                |> resource_path(...)
                |> file_get_contents(...)
                |> (fn ($x) => json_decode($x, associative: true, flags: JSON_THROW_ON_ERROR));
        $items = ('assets/data/collection_log_info.json'
            |> resource_path(...)
            |> file_get_contents(...)
            |> (fn ($x) => json_decode($x, associative: true, flags: JSON_THROW_ON_ERROR))
            |> collect(...))
            ->pluck('pages')->flatten(1)->pluck('items')->flatten(1)->pluck('id')
            ->mapWithKeys(fn (int $identifier): array => [$aliases[$identifier] ?? $identifier => true]);
        $counts = [];

        foreach ($member->collectionLogs as $log) {
            $identifier = $aliases[$log->item_id] ?? $log->item_id;
            $counts[$identifier] = max($counts[$identifier] ?? 0, $log->item_count);
        }

        foreach ($updates as $update) {
            $quantities = [];

            foreach ($update['items'] as $item) {
                $identifier = $aliases[$item['item_id']] ?? $item['item_id'];

                if ($update['type'] === 'drop' && ! $items->has($identifier)) {
                    continue;
                }

                $quantities[$identifier] = $update['type'] === 'drop'
                    ? ($quantities[$identifier] ?? 0) + $item['quantity']
                    : max($quantities[$identifier] ?? 0, $item['quantity']);
            }

            foreach ($quantities as $identifier => $quantity) {
                $quantity = match ($update['type']) {
                    'drop' => ($counts[$identifier] ?? 0) + $quantity,
                    'unlock' => max($counts[$identifier] ?? 0, 1),
                    'scan' => $quantity,
                };

                if ($identifiers = array_keys($aliases, $identifier)) {
                    $member->collectionLogs()->whereIn('item_id', $identifiers)->delete();
                }

                $member->collectionLogs()->updateOrCreate(['item_id' => $identifier], ['item_count' => $quantity]);
                $counts[$identifier] = $quantity;
            }
        }
    }
}
