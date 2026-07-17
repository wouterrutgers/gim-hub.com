<?php

use App\Models\Member;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    const DEFAULT_HUES = [330, 100, 230, 170, 40];

    public function up(): void
    {
        Schema::table('members', function (Blueprint $table) {
            $table->unsignedSmallInteger('color_hue_degrees')->nullable();
        });

        // Assign default colors to existing members within each group, ordered by creation.
        $groupIds = DB::table('members')
            ->where('name', '!=', Member::SHARED_MEMBER)
            ->distinct()
            ->pluck('group_id');

        foreach ($groupIds as $groupId) {
            $members = Member::where('group_id', '=', $groupId)
                ->where('name', '!=', Member::SHARED_MEMBER)
                ->orderBy('id')
                ->get();

            foreach ($members as $index => $member) {
                $member->update(['color_hue_degrees' => self::DEFAULT_HUES[$index] ?? 0]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('members', function (Blueprint $table) {
            $table->dropColumn('color_hue_degrees');
        });
    }
};
