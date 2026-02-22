<?php

namespace App\Console\Commands;

use App\Models\Group;
use App\Models\Member;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Throwable;

class ImportGroupironData extends Command
{
    protected $signature = 'groupiron:import
        {group : Group name}
        {token : Group token}';

    protected $description = 'Import group data from groupiron.men';

    public function handle(): int
    {
        $groupName = $this->argument('group');
        $token = $this->argument('token');
        $endpoint = sprintf('%s/api/group/%s/get-group-data', 'https://groupiron.men', rawurlencode($groupName));

        $response = Http::acceptJson()
            ->withHeaders(['Authorization' => $token])
            ->get($endpoint, ['from_time' => '1970-01-01T00:00:00.000Z'])
            ->throw();

        $payload = $response->json();

        $importedMembers = 0;
        $importedProperties = 0;
        $importedCollectionItems = 0;

        try {
            DB::transaction(function () use ($groupName, $token, $payload, &$importedMembers, &$importedProperties, &$importedCollectionItems): void {
                $group = Group::firstOrCreate(
                    ['name' => $groupName],
                    ['hash' => $token]
                );

                Member::firstOrCreate([
                    'group_id' => $group->id,
                    'name' => Member::SHARED_MEMBER,
                ]);

                foreach ($payload as $index => $memberData) {
                    if (! is_array($memberData)) {
                        $this->warn("Skipping malformed member payload at index {$index}.");

                        continue;
                    }

                    $memberName = $memberData['name'];

                    $member = Member::firstOrCreate([
                        'group_id' => $group->id,
                        'name' => $memberName,
                    ]);

                    foreach (Member::PROPERTY_KEYS as $propertyKey) {
                        if (is_null($memberData[$propertyKey] ?? null)) {
                            continue;
                        }

                        $member->properties()->updateOrCreate(
                            ['key' => $propertyKey],
                            [
                                'value' => $this->normalizePropertyValue($propertyKey, $memberData[$propertyKey]),
                                'updated_at' => now(),
                            ]
                        );
                        $importedProperties++;
                    }

                    $collectionLog = $memberData['collection_log_v2'] ?? null;
                    if (is_array($collectionLog)) {
                        $importedCollectionItems += $this->syncCollectionLog($member, $collectionLog);
                    }

                    $importedMembers++;
                }
            });
        } catch (Throwable $e) {
            $this->error("Import failed: {$e->getMessage()}");

            return static::FAILURE;
        }

        $this->info("Import complete for '{$groupName}'.");
        $this->line("Members imported: {$importedMembers}");
        $this->line("Properties imported: {$importedProperties}");
        $this->line("Collection log items imported: {$importedCollectionItems}");

        return static::SUCCESS;
    }

    protected function normalizePropertyValue(string $propertyKey, mixed $value): mixed
    {
        if ($propertyKey === 'coordinates' && is_array($value) && count($value) === 3) {
            $value[] = 0;
        }

        if ($propertyKey === 'skills' && is_array($value) && count($value) === 23) {
            $value[] = 1;
        }

        return $value;
    }

    protected function syncCollectionLog(Member $member, array $collectionLog): int
    {
        $member->collectionLogs()->delete();

        $itemCounts = [];
        for ($i = 0; $i + 1 < count($collectionLog); $i += 2) {
            $itemId = $collectionLog[$i];
            $itemCount = max(0, (int) $collectionLog[$i + 1]);

            if ($itemId <= 0 || $itemCount === 0) {
                continue;
            }

            $itemCounts[$itemId] = ($itemCounts[$itemId] ?? 0) + $itemCount;
        }

        if ($itemCounts === []) {
            return 0;
        }

        $insertRows = [];
        foreach ($itemCounts as $itemId => $itemCount) {
            $insertRows[] = [
                'member_id' => $member->id,
                'item_id' => $itemId,
                'item_count' => $itemCount,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        DB::table('collection_logs')->insert($insertRows);

        return count($insertRows);
    }
}
