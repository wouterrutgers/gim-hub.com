<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('collection_logs', function (Blueprint $table): void {
            $table->unique(['member_id', 'item_id']);
        });
    }
};
