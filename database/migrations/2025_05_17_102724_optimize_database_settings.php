<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'sqlite') {
            return;
        }

        DB::unprepared('PRAGMA auto_vacuum = INCREMENTAL;');
        DB::unprepared('VACUUM;');
        DB::unprepared('PRAGMA journal_mode = DELETE;');
        DB::unprepared('PRAGMA page_size = 32768;');
        DB::unprepared('VACUUM;');
        DB::unprepared('PRAGMA journal_mode = WAL;');
    }
};
