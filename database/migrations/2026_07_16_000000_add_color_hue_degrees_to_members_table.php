<?php

use App\Models\Member;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('members', function (Blueprint $table) {
            $table->unsignedSmallInteger('color_hue_degrees')->nullable();
        });

        $groupIds = DB::table('members')
            ->where('name', '!=', Member::SHARED_MEMBER)
            ->distinct()
            ->pluck('group_id');

        foreach ($groupIds as $groupId) {
            $members = Member::where('group_id', '=', $groupId)
                ->where('name', '!=', Member::SHARED_MEMBER)
                ->orderBy('name')
                ->get();

            foreach ($members as $index => $member) {
                $member->update(['color_hue_degrees' => Member::DEFAULT_COLOR_HUES[$index] ?? 0]);
            }
        }
    }
};
