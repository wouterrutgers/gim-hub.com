<?php

use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Facades\Http;

it('recovers prices immediately after an upstream failure', function (): void {
    Exceptions::fake();
    Http::fake([
        'https://prices.runescape.wiki/api/v1/osrs/latest' => Http::sequence()
            ->pushStatus(503)
            ->push(['data' => [4151 => ['high' => 1_500_000, 'low' => 1_400_000]]]),
    ]);

    $this->getJson('/api/ge-prices.json')->assertInternalServerError();
    $this->getJson('/api/ge-prices.json')->assertOk()->assertExactJson(['4151' => 1_450_000]);

    Exceptions::assertReported(RequestException::class);
});
