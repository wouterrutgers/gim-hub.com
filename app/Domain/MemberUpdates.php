<?php

namespace App\Domain;

use App\Models\Member;

class MemberUpdates
{
    public static function apply(Member $member, array $data): void
    {
        static::properties($member, $data);

        if (! empty($data['shared_bank'])) {
            $sharedMember = Member::firstOrCreate([
                'group_id' => $member->group_id,
                'name' => Member::SHARED_MEMBER,
            ]);

            static::properties($sharedMember, ['bank' => $data['shared_bank']]);
        }

        if (! empty($data['collection_log_v2'])) {
            CollectionLogUpdates::applyLegacy($member, $data['collection_log_v2']);
        }

        if (! empty($data['collection_log_updates'])) {
            CollectionLogUpdates::apply($member, $data['collection_log_updates']);
        }
    }

    protected static function properties(Member $member, array $data): void
    {
        $properties = Member::PROPERTY_KEYS
                |> array_flip(...)
                |> (fn ($x) => array_intersect_key($data, $x))
                |> (fn ($x) => array_filter($x, fn (mixed $value): bool => ! is_null($value)));
        $keys = array_keys($properties);

        foreach (Member::PARTIAL_PROPERTY_KEYS as $key => $partialKey) {
            if (isset($data[$partialKey]) && ! isset($properties[$key])) {
                $keys[] = $key;
            }
        }

        if ($keys === []) {
            return;
        }

        $current = $member->properties()->whereIn('key', $keys)->get(['key', 'value'])->pluck('value', 'key')->all();

        if (isset($properties['stash_units'])) {
            $units = array_column($current['stash_units'] ?? [], null, 'id');

            foreach ($properties['stash_units'] as $unit) {
                $units[$unit['id']] = $unit;
            }

            $properties['stash_units'] = array_values($units);
        }

        foreach (Member::PARTIAL_PROPERTY_KEYS as $key => $partialKey) {
            if (isset($data[$partialKey]) && ! isset($properties[$key])) {
                $properties[$key] = static::applyPartial($current[$key] ?? [], $data[$partialKey]);
            }
        }

        $rows = [];

        foreach ($properties as $key => $value) {
            if (array_key_exists($key, $current) && static::samePropertyValue($current[$key], $value)) {
                continue;
            }

            $rows[] = ['key' => $key, 'value' => json_encode($value, JSON_THROW_ON_ERROR)];
        }

        if ($rows !== []) {
            $member->properties()->upsert($rows, ['member_id', 'key'], ['value', 'updated_at']);
        }
    }

    protected static function applyPartial(array $items, array $partial): array
    {
        $quantities = [];

        for ($index = 0; $index < count($partial) - 1; $index += 2) {
            $quantities[$partial[$index]] = $partial[$index + 1];
        }

        for ($index = 0; $index < count($items) - 1; $index += 2) {
            $identifier = $items[$index];
            $items[$index + 1] = max(0, $items[$index + 1] + ($quantities[$identifier] ?? 0));
            unset($quantities[$identifier]);
        }

        foreach ($quantities as $identifier => $quantity) {
            $items[] = $identifier;
            $items[] = max(0, $quantity);
        }

        return $items;
    }

    protected static function samePropertyValue(mixed $current, mixed $value): bool
    {
        if ($current === $value) {
            return true;
        }

        if (! is_array($current) || ! is_array($value) || count($current) !== count($value)) {
            return false;
        }

        return array_all($current, fn ($item, $key) => array_key_exists($key, $value) && static::samePropertyValue($item, $value[$key]));
    }
}
