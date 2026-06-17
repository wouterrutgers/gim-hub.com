<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('member_properties')
            ->whereIn('member_id', DB::table('members')
                ->select('id')
                ->where('mode', '=', 'leagues'))
            ->delete();

        DB::table('skill_stats')
            ->whereIn('member_id', DB::table('members')
                ->select('id')
                ->where('mode', '=', 'leagues'))
            ->delete();

        DB::table('collection_logs')
            ->whereIn('member_id', DB::table('members')
                ->select('id')
                ->where('mode', '=', 'leagues'))
            ->delete();

        DB::table('members')
            ->where('mode', '=', 'leagues')
            ->delete();

        Schema::table('members', function (Blueprint $table): void {
            $table->index(['group_id', 'name'], 'members_group_id_name_index');
        });

        Schema::table('members', function (Blueprint $table): void {
            $table->dropIndex('members_group_id_mode_name_index');
            $table->dropColumn('mode');
        });
    }
};
