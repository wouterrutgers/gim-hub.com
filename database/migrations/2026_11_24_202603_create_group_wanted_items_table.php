<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('group_wanted_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('group_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('item_id');
            $table->unsignedInteger('target_quantity');
            $table->timestamps();
            $table->unique(['group_id', 'item_id']);
        });
    }
};
