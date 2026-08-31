<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('members', function (Blueprint $table) {
            $table->boolean('chat_relay_enabled')->default(false)->after('last_online_at');
        });

        Schema::create('group_chat_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('group_id')->constrained()->cascadeOnDelete();
            $table->foreignId('member_id')->nullable()->constrained()->nullOnDelete();
            $table->string('sender_name');
            $table->text('message');
            $table->dateTime('sent_at');
            $table->timestamps();

            $table->index(['group_id', 'sent_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('group_chat_messages');

        Schema::table('members', function (Blueprint $table) {
            $table->dropColumn('chat_relay_enabled');
        });
    }
};
