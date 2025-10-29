<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('collection_pages', function (Blueprint $table) {
            $table->dropForeign(['collection_tab_id']);
        });

        Schema::table('collection_logs', function (Blueprint $table) {
            $table->dropForeign(['collection_page_id']);
        });

        Schema::table('collection_tabs', function (Blueprint $table) {
            $table->id()->change();
        });

        Schema::table('collection_pages', function (Blueprint $table) {
            $table->foreign('collection_tab_id')->references('id')->on('collection_tabs');
        });

        Schema::table('collection_logs', function (Blueprint $table) {
            $table->foreign('collection_page_id')->references('id')->on('collection_pages');
        });
    }
};
