<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('members', function (Blueprint $table) {
            $table->dateTime('poh_wardrobe_last_update')->nullable()->after('seed_vault');
            $table->json('poh_wardrobe')->nullable()->after('poh_wardrobe_last_update');
        });
    }
};
