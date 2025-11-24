<?php

use App\Models\SkillStat;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        SkillStat::eachById(function (SkillStat $skillStats) {
            $skillStats->update([
                'skills' => array_pad($skillStats->skills, 24, 0),
            ]);
        });
    }
};
