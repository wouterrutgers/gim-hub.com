<?php

namespace App\Console\Commands;

use App\Models\CollectionPage;
use App\Models\CollectionTab;
use Illuminate\Console\Command;

class UpdateCollectionPages extends Command
{
    protected $signature = 'update-collection-pages';

    protected $description = 'Update all collection pages';

    public function handle(): int
    {
        $tabs = [];
        $pages = [];

        $tabs[] = CollectionTab::updateOrCreate([
            'tab_id' => 0,
            'name' => 'Bosses',
        ])->id;

        $tabs[] = CollectionTab::updateOrCreate([
            'tab_id' => 1,
            'name' => 'Raids',
        ])->id;

        $tabs[] = CollectionTab::updateOrCreate([
            'tab_id' => 2,
            'name' => 'Clues',
        ])->id;

        $tabs[] = CollectionTab::updateOrCreate([
            'tab_id' => 3,
            'name' => 'Minigames',
        ])->id;

        $tabs[] = CollectionTab::updateOrCreate([
            'tab_id' => 4,
            'name' => 'Other',
        ])->id;

        foreach (json_decode(file_get_contents(storage_path('cache/collection_log_info.json')), true) as $tab) {
            foreach ($tab['pages'] as $page) {
                $pages[] = CollectionTab::where('tab_id', '=', $tab['tabId'])->firstOrFail()
                    ->pages()->updateOrCreate([], [
                        'name' => $page['name'],
                    ])->id;
            }
        }

        CollectionTab::whereNotIn('id', $tabs)
            ->delete();

        CollectionPage::whereNotIn('id', $pages)
            ->delete();

        return static::SUCCESS;
    }
}
