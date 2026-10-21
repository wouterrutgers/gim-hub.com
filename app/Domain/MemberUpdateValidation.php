<?php

namespace App\Domain;

use Closure;

class MemberUpdateValidation
{
    public static function validate(array $input): array
    {
        $integerList = function (int $minimum = 0, int $maximum = 4294967295, bool $pairs = false): Closure {
            return function (string $attribute, array $value, Closure $fail) use ($minimum, $maximum, $pairs): void {
                if ($pairs && count($value) % 2 !== 0) {
                    $fail('Storage contents must contain item and quantity pairs.');

                    return;
                }

                foreach ($value as $itemValue) {
                    if (! is_int($itemValue) || $itemValue < $minimum || $itemValue > $maximum) {
                        $fail("Snapshot values must be integers between {$minimum} and {$maximum}.");

                        return;
                    }
                }
            };
        };
        $itemQuantityPairs = $integerList(minimum: 1, maximum: 2147483647, pairs: true);

        $rules = [
            'name' => ['required', 'string'],
            'stats' => [
                'bail', 'nullable', 'array', 'list', ['size', 8], $integerList(),
                function (string $attribute, array $value, Closure $fail): void {
                    if ($value[5] !== 100) {
                        $fail('Run energy maximum must be 100.');
                    }
                },
            ],
            'coordinates' => ['bail', 'nullable', 'array', 'list', ['size', 4], $integerList()],
            'skills' => ['bail', 'nullable', 'array', 'list', ['size', 24], $integerList()],
            'quests' => ['bail', 'nullable', 'array', 'list', ['max', 250], $integerList(maximum: 2)],
            'inventory' => ['bail', 'nullable', 'array', 'list', ['size', 56], $integerList()],
            'equipment' => ['bail', 'nullable', 'array', 'list', ['size', 28], $integerList()],
            'bank' => ['bail', 'nullable', 'array', 'list', ['max', 3000], $integerList(minimum: -1, pairs: true)],
            'bank_partial' => ['bail', 'nullable', 'array', 'list', ['max', 3000], $integerList(minimum: -2147483648, maximum: 2147483647, pairs: true)],
            'shared_bank' => ['bail', 'nullable', 'array', 'list', ['max', 1000], $integerList(minimum: -1, pairs: true)],
            'rune_pouch' => ['bail', 'nullable', 'array', 'list', ['size', 8], $integerList(minimum: -1)],
            'seed_vault' => ['bail', 'nullable', 'array', 'list', ['max', 500], $integerList(minimum: -1, pairs: true)],
            'potion_storage' => ['bail', 'nullable', 'array', 'list', ['max', 2000], $integerList(minimum: -1, pairs: true)],
            'poh_costume_room' => ['bail', 'nullable', 'array', 'list', ['max', 4000], $integerList(minimum: -1, pairs: true)],
            'poh_spice_rack' => ['bail', 'sometimes', 'nullable', 'array', 'list', ['max', 16], $itemQuantityPairs],
            'poh_pet_house' => ['bail', 'sometimes', 'nullable', 'array', 'list', ['max', 400], $itemQuantityPairs],
            'poh_servants_moneybag' => ['bail', 'sometimes', 'nullable', 'array', 'list', ['max', 2], $itemQuantityPairs],
            'blast_furnace_coffer' => ['bail', 'sometimes', 'nullable', 'array', 'list', ['max', 2], $itemQuantityPairs],
            'nightmare_zone_coffer' => ['bail', 'sometimes', 'nullable', 'array', 'list', ['max', 2], $itemQuantityPairs],
            'scar_essence_mine_coffer' => ['bail', 'sometimes', 'nullable', 'array', 'list', ['max', 2], $itemQuantityPairs],
            'plank_sack' => ['bail', 'nullable', 'array', 'list', ['max', 14], $integerList(minimum: -1, pairs: true)],
            'master_scroll_book' => ['bail', 'nullable', 'array', 'list', ['max', 40], $integerList(minimum: -1, pairs: true)],
            'essence_pouches' => ['bail', 'nullable', 'array', 'list', ['max', 16], $integerList(minimum: -1, pairs: true)],
            'tackle_box' => ['bail', 'nullable', 'array', 'list', ['max', 100], $integerList(minimum: -1, pairs: true)],
            'tackle_box_partial' => ['bail', 'nullable', 'array', 'list', ['max', 100], $integerList(minimum: -2147483648, maximum: 2147483647, pairs: true)],
            'tool_leprechaun' => ['bail', 'nullable', 'array', 'list', ['max', 24], $integerList(minimum: -1, pairs: true)],
            'elnock_inquisitor' => ['bail', 'nullable', 'array', 'list', ['max', 6], $integerList(minimum: -1, pairs: true)],
            'coal_bag' => ['bail', 'nullable', 'array', 'list', ['max', 2], $integerList(minimum: -1, pairs: true)],
            'fish_barrel' => ['bail', 'nullable', 'array', 'list', ['max', 100], $integerList(minimum: -1, pairs: true)],
            'herb_sack' => ['bail', 'sometimes', 'nullable', 'array', 'list', ['max', 30], $itemQuantityPairs],
            'looting_bag' => ['bail', 'sometimes', 'nullable', 'array', 'list', ['max', 56], $itemQuantityPairs],
            'seed_box' => ['bail', 'sometimes', 'nullable', 'array', 'list', ['max', 12], $itemQuantityPairs],
            'gem_bag' => ['bail', 'sometimes', 'nullable', 'array', 'list', ['max', 10], $itemQuantityPairs],
            'chugging_barrel' => ['bail', 'sometimes', 'nullable', 'array', 'list', ['max', 100], $itemQuantityPairs],
            'stash_units' => ['sometimes', 'nullable', 'array', 'list', ['max', 200]],
            'quiver' => ['bail', 'nullable', 'array', 'list', ['size', 2], $integerList()],
            'diary_vars' => ['bail', 'nullable', 'array', 'list', ['max', 62], $integerList(minimum: -2147483648, maximum: 2147483647)],
            'collection_log_updates' => ['sometimes', 'array', 'list'],
            'interacting' => ['nullable'],
            'timezone' => ['nullable', 'string', ['timezone', 'all_with_bc']],
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
                $rules[$attribute] = ['required', ['array', 'type', 'items', 'total_obtained']];
                $rules["{$attribute}.type"] = ['required', ['in', 'drop', 'unlock', 'scan']];
                $rules["{$attribute}.total_obtained"] = ['sometimes', 'required', 'integer', ['min', 0], ['max', 2147483647], ['prohibited_unless', "{$attribute}.type", 'scan']];
                $minimum = ($update['type'] ?? null) === 'scan' ? 0 : 1;
                $rules["{$attribute}.items"] = [
                    'bail', 'present', 'array', 'list', ['min', isset($update['total_obtained']) ? 0 : 1],
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

        return validator($input, [...$rules, ...ActivityUpdates::rules($input)])->validate();
    }
}
