<?php

namespace App\Domain;

use Closure;

class MemberUpdateValidation
{
    public static function validate(array $input): array
    {
        $itemQuantityPairs = function (string $attribute, mixed $value, Closure $fail): void {
            if (count($value) % 2 !== 0) {
                $fail('Storage contents must contain item and quantity pairs.');

                return;
            }

            foreach ($value as $itemValue) {
                if (! is_int($itemValue) || $itemValue < 1 || $itemValue > 2147483647) {
                    $fail('Storage items and quantities must be positive integers.');

                    return;
                }
            }
        };

        $rules = [
            'name' => ['required', 'string'],
            'stats' => ['nullable', 'array', ['size', 8]],
            'coordinates' => ['nullable', 'array', ['size', 4]],
            'skills' => ['nullable', 'array', ['size', 24]],
            'quests' => ['nullable', 'array', ['max', 250]],
            'inventory' => ['nullable', 'array', ['size', 56]],
            'equipment' => ['nullable', 'array', ['size', 28]],
            'bank' => ['nullable', 'array', ['max', 3000]],
            'bank_partial' => ['nullable', 'array', ['max', 3000]],
            'shared_bank' => ['nullable', 'array', ['max', 1000]],
            'rune_pouch' => ['nullable', 'array', ['size', 8]],
            'seed_vault' => ['nullable', 'array', ['max', 500]],
            'potion_storage' => ['nullable', 'array', ['max', 2000]],
            'poh_costume_room' => ['nullable', 'array', ['max', 2500]],
            'plank_sack' => ['nullable', 'array', ['max', 14]],
            'master_scroll_book' => ['nullable', 'array', ['max', 40]],
            'essence_pouches' => ['nullable', 'array', ['max', 16]],
            'tackle_box' => ['nullable', 'array', ['max', 100]],
            'tackle_box_partial' => ['nullable', 'array', ['max', 100]],
            'tool_leprechaun' => ['nullable', 'array', ['max', 24]],
            'elnock_inquisitor' => ['nullable', 'array', ['max', 6]],
            'coal_bag' => ['nullable', 'array', ['max', 2]],
            'fish_barrel' => ['nullable', 'array', ['max', 100]],
            'herb_sack' => ['bail', 'sometimes', 'nullable', 'array', 'list', ['max', 30], $itemQuantityPairs],
            'looting_bag' => ['bail', 'sometimes', 'nullable', 'array', 'list', ['max', 56], $itemQuantityPairs],
            'seed_box' => ['bail', 'sometimes', 'nullable', 'array', 'list', ['max', 12], $itemQuantityPairs],
            'gem_bag' => ['bail', 'sometimes', 'nullable', 'array', 'list', ['max', 10], $itemQuantityPairs],
            'chugging_barrel' => ['bail', 'sometimes', 'nullable', 'array', 'list', ['max', 100], $itemQuantityPairs],
            'stash_units' => ['sometimes', 'nullable', 'array', 'list', ['max', 200]],
            'quiver' => ['nullable', 'array', ['size', 2]],
            'diary_vars' => ['nullable', 'array', ['max', 62]],
            'collection_log_updates' => ['sometimes', 'array', 'list'],
            'interacting' => ['nullable'],
            'timezone' => ['nullable', 'string', 'timezone'],
        ];

        if (is_array($input['stash_units'] ?? null)) {
            $identifiers = [];

            foreach ($input['stash_units'] as $unit) {
                $identifier = filter_var($unit['id'] ?? null, FILTER_VALIDATE_INT);

                if ($identifier !== false) {
                    $identifiers[$identifier] = ($identifiers[$identifier] ?? 0) + 1;
                }
            }

            foreach ($input['stash_units'] as $index => $unit) {
                $attribute = "stash_units.{$index}";
                $rules[$attribute] = ['required', ['array', 'id', 'name', 'tier', 'state', 'items', 'alternatives']];
                $rules["{$attribute}.id"] = [
                    'bail', 'required', 'integer', ['min', 1],
                    function (string $attribute, mixed $value, Closure $fail) use ($identifiers): void {
                        if ($identifiers[filter_var($value, FILTER_VALIDATE_INT)] > 1) {
                            $fail('STASH unit IDs must be distinct.');
                        }
                    },
                ];
                $rules["{$attribute}.name"] = ['required', 'string', ['max', 200]];
                $rules["{$attribute}.tier"] = ['required', ['in', 'Beginner', 'Easy', 'Medium', 'Hard', 'Elite', 'Master']];
                $rules["{$attribute}.state"] = ['required', ['in', 'unbuilt', 'empty', 'filled']];
                $rules["{$attribute}.items"] = ['bail', 'present', 'array', 'list', ['max', 40], $itemQuantityPairs];
                $rules["{$attribute}.alternatives"] = ['present', 'array', 'list', ['max', 10]];

                if (is_array($unit['alternatives'] ?? null)) {
                    foreach (array_keys($unit['alternatives']) as $alternativeIndex) {
                        $rules["{$attribute}.alternatives.{$alternativeIndex}"] = ['required', 'string', ['max', 200]];
                    }
                }
            }
        }

        if (is_array($input['collection_log_updates'] ?? null)) {
            foreach ($input['collection_log_updates'] as $updateIndex => $update) {
                $attribute = "collection_log_updates.{$updateIndex}";
                $rules[$attribute] = ['required', ['array', 'type', 'items']];
                $rules["{$attribute}.type"] = ['required', ['in', 'drop', 'unlock', 'scan']];
                $minimum = ($update['type'] ?? null) === 'scan' ? 0 : 1;
                $rules["{$attribute}.items"] = [
                    'bail', 'required', 'array', 'list', ['min', 1],
                    function (string $attribute, array $items, Closure $fail) use ($minimum): void {
                        foreach ($items as $index => $item) {
                            if (! is_array($item)) {
                                $fail("{$attribute}.{$index}", 'Collection log items must contain an item ID and quantity.');

                                continue;
                            }

                            if (array_diff_key($item, ['item_id' => true, 'quantity' => true]) !== []) {
                                $fail("{$attribute}.{$index}", 'Collection log items may only contain an item ID and quantity.');
                            }

                            $identifier = filter_var($item['item_id'] ?? null, FILTER_VALIDATE_INT);
                            $quantity = filter_var($item['quantity'] ?? null, FILTER_VALIDATE_INT);

                            if ($identifier === false || $identifier < 1) {
                                $fail("{$attribute}.{$index}.item_id", 'Collection log item IDs must be positive integers.');
                            }

                            if ($quantity === false || $quantity < $minimum || $quantity > 2147483647) {
                                $fail("{$attribute}.{$index}.quantity", "Collection log quantities must be integers between {$minimum} and 2147483647.");
                            }
                        }
                    },
                ];
            }
        }

        return validator($input, $rules)->validate();
    }
}
