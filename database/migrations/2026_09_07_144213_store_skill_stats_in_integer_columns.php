<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected array $skills = [
        'agility',
        'attack',
        'construction',
        'cooking',
        'crafting',
        'defence',
        'farming',
        'firemaking',
        'fishing',
        'fletching',
        'herblore',
        'hitpoints',
        'hunter',
        'magic',
        'mining',
        'prayer',
        'ranged',
        'runecraft',
        'slayer',
        'smithing',
        'strength',
        'thieving',
        'woodcutting',
        'sailing',
    ];

    public function up(): void
    {
        Schema::table('skill_stats', function (Blueprint $table): void {
            foreach ($this->skills as $skill) {
                $table->unsignedInteger($skill)->nullable();
            }
        });

        DB::table('skill_stats')->chunkById(500, function (Collection $stats): void {
            $rows = [];
            foreach ($stats as $stat) {
                $rows[] = json_decode($stat->skills, associative: true, flags: JSON_THROW_ON_ERROR)
                        |> (fn ($x) => array_combine($this->skills, $x))
                        |> (fn ($x) => array_merge((array) $stat, $x));
            }

            DB::table('skill_stats')->upsert($rows, ['id'], $this->skills);
        });

        DB::table('skill_stats')->where('type', '=', 'day')->update(['type' => 'hourly']);
        DB::table('skill_stats')->where('type', '=', 'month')->update(['type' => 'daily']);
        DB::table('skill_stats')->where('type', '=', 'year')->update(['type' => 'monthly']);

        Schema::table('skill_stats', function (Blueprint $table): void {
            foreach ($this->skills as $skill) {
                $table->unsignedInteger($skill)->nullable(value: false)->change();
            }

            $table->dropColumn('skills');
            $table->index(['member_id', 'type', 'created_at']);
        });
    }
};
