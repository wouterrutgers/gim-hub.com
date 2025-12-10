<?php

use App\Models\Member;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        Member::eachById(function (Member $member) {
            foreach (Member::PROPERTY_KEYS as $property) {
                $value = $member->{$property};
                $lastUpdate = $member->{"{$property}_last_update"};

                if (! $value) {
                    continue;
                }

                $member->properties()->create([
                    'key' => $property,
                    'value' => $value,
                    'last_update' => $lastUpdate,
                ]);
            }
        });
    }
};
