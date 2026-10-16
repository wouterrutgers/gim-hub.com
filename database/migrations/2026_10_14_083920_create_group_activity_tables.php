<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_entries', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('group_id')->constrained()->cascadeOnDelete();
            $table->foreignId('member_id')->constrained()->cascadeOnDelete();
            $table->uuid('source_id');
            $table->string('subject', 80)->default('');
            $table->unsignedInteger('revision');
            $table->string('type', 20);
            $table->unsignedBigInteger('started_at');
            $table->unsignedBigInteger('occurred_at');
            $table->json('data');
            $table->timestamps(3);
            $table->unique(['member_id', 'source_id', 'subject']);
            $table->index(['group_id', 'started_at', 'id']);
            $table->index(['group_id', 'updated_at']);
            $table->index('occurred_at');
        });
        Schema::create('activity_receipts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('member_id')->constrained()->cascadeOnDelete();
            $table->uuid('source_id');
            $table->foreignId('activity_entry_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['member_id', 'source_id']);
            $table->index('created_at');
        });
    }
};
