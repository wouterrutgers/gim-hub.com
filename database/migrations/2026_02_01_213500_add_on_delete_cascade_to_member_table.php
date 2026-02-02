<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('member_properties', function (Blueprint $table) {
            $table->dropForeign(['member_id']);
            $table->foreign('member_id')->references('id')->on('members')->onDelete('cascade');
        });

        Schema::table('skill_stats', function (Blueprint $table) {
            $table->dropForeign(['member_id']);
            $table->foreign('member_id')->references('id')->on('members')->onDelete('cascade');
        });

        Schema::table('collection_logs', function (Blueprint $table) {
            $table->dropForeign(['member_id']);
            $table->foreign('member_id')->references('id')->on('members')->onDelete('cascade');
        });
    }
};
