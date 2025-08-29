<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('members', function (Blueprint $table) {
            $table->dateTime('quiver_last_update')->nullable()->after('seed_vault');
            $table->json('quiver')->nullable()->after('quiver_last_update');
        });
    }
};
