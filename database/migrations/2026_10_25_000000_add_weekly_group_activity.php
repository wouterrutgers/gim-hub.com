<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('activity_entries', function (Blueprint $table): void {
            $table->boolean('is_weekly')->default(false);
            $table->index(['is_weekly', 'occurred_at']);
        });
    }
};
