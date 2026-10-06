<?php

namespace App\Domain;

use Illuminate\Support\Facades\Http;
use UnexpectedValueException;

class GePrices
{
    public static function prices(): array
    {
        return cache()->remember('ge_prices', now()->addHours(4), function (): array {
            return static::fetch();
        });
    }

    protected static function fetch(): array
    {
        $wikiGEPrices = Http::withUserAgent('GIM hub (https://gim-hub.com)')
            ->get('https://prices.runescape.wiki/api/v1/osrs/latest')
            ->throw()
            ->json('data', []);

        if (! $wikiGEPrices) {
            throw new UnexpectedValueException('The OSRS Wiki returned no Grand Exchange prices.');
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
