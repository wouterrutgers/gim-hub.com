<?php

use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Http;

it('refreshes the version from the approved plugin commit', function (?string $version): void {
    Http::preventStrayRequests();
    $commit = str_repeat('a', 40);
    Http::fake([
        'https://raw.githubusercontent.com/runelite/plugin-hub/master/plugins/gim-hub' => Http::response("commit={$commit}\n"),
        "https://raw.githubusercontent.com/wouterrutgers/gim-hub-plugin/{$commit}/runelite-plugin.properties" => Http::response(
            "plugins=gimhub.GimHubPlugin\n".(is_null($version) ? '' : "version={$version}\n"),
        ),
    ]);

    $this->artisan('plugin:refresh-release')->assertSuccessful();

    expect(cache('plugin.latest_version'))->toBe($version);
})->with(['versioned release' => ['1.9.1'], 'existing unversioned release' => [null]]);

it('preserves the last approved version when a release refresh fails', function (): void {
    cache()->forever('plugin.latest_version', '1.9.1');
    Http::preventStrayRequests();
    Http::fake([
        'https://raw.githubusercontent.com/runelite/plugin-hub/master/plugins/gim-hub' => Http::response('', 503),
    ]);

    expect(fn (): int => Artisan::call('plugin:refresh-release'))->toThrow(RequestException::class);
    expect(cache('plugin.latest_version'))->toBe('1.9.1');
});
