<?php

namespace App\Domain;

use Illuminate\Support\Facades\Http;

class GePrices
{
    public static function prices(): array
    {
        return cache()->remember('ge_prices', now()->addHours(4), function () {
            return static::fetch();
        });
    }

    protected static function fetch(): array
    {
        $response = Http::withUserAgent('GIM hub (https://gim-hub.com)')->get('https://prices.runescape.wiki/api/v1/osrs/latest');

        if (! $response->successful()) {
            return [];
        }

        $wikiGEPrices = $response->json('data', []);

        if (empty($wikiGEPrices)) {
            return [];
        }

        $gePrices = [];
        foreach ($wikiGEPrices as $itemId => $wikiGEPrice) {
            $avgGEPrice = 0;

            if (! empty($wikiGEPrice['high'])) {
                $avgGEPrice = $wikiGEPrice['high'];
            }

            if (! empty($wikiGEPrice['low'])) {
                if ($avgGEPrice > 0) {
                    $avgGEPrice = (int) (($avgGEPrice + $wikiGEPrice['low']) / 2);
                } else {
                    $avgGEPrice = $wikiGEPrice['low'];
                }
            }

            if ($avgGEPrice > 0) {
                $gePrices[$itemId] = $avgGEPrice;
            }
        }

        return $gePrices;
    }
}
