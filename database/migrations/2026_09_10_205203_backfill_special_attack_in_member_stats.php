<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('member_properties')
            ->where('key', '=', 'stats')
            ->whereJsonLength('value', '=', 7)
            ->update(['value' => DB::raw("json_set(value, '$[7]', 100)")]);
    }
};
