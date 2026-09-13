<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class RefreshPluginRelease extends Command
{
    protected $signature = 'plugin:refresh-release';

    protected $description = 'Refresh the latest approved GIM hub plugin version';

    public function handle(): int
    {
        $manifest = Http::get('https://raw.githubusercontent.com/runelite/plugin-hub/master/plugins/gim-hub')
            ->throw()->body();

        preg_match('/^commit=([a-f0-9]{40})\s*$/m', $manifest, $matches);

        $properties = Http::get("https://raw.githubusercontent.com/wouterrutgers/gim-hub-plugin/{$matches[1]}/runelite-plugin.properties")
            ->throw()->body();

        $version = preg_match('/^version=([^\r\n]*)/m', $properties, $matches) === 1 ? trim($matches[1]) : null;

        cache()->forever('plugin.latest_version', $version);
        $this->info(is_null($version) ? 'The approved plugin does not report a version yet.' : "Latest approved plugin version: {$version}");

        return static::SUCCESS;
    }
}
