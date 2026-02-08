<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

class ChangelogNew extends Command
{
    protected $signature = 'changelog:new {title : The changelog entry title} {--date= : Date prefix (YYYY-MM-DD), defaults to today}';

    protected $description = 'Create a new changelog markdown entry in resources/changelog';

    public function handle(): int
    {
        $title = $this->argument('title');
        $date = $this->option('date') ?: now()->toDateString();

        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            $this->error('Invalid --date, expected YYYY-MM-DD');

            return static::FAILURE;
        }

        $slug = Str::slug($title);

        $dir = resource_path('changelog');
        if (! File::isDirectory($dir)) {
            File::makeDirectory($dir, 0755, true);
        }

        $baseName = "{$date}-{$slug}";
        $path = $dir.DIRECTORY_SEPARATOR.$baseName.'.md';

        File::put($path, "# {$title}\n\n- \n");

        $relative = Str::replaceFirst(base_path().DIRECTORY_SEPARATOR, '', $path);
        $this->info("Created: {$relative}");

        return static::SUCCESS;
    }
}
