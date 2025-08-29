<?php

use App\Models\CollectionLog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::drop('new_collection_logs');

        Schema::table('collection_logs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('collection_page_id');
            $table->dropColumn('items');
            $table->dropColumn('counts');
        });

        Schema::table('collection_logs', function (Blueprint $table) {
            $table->unsignedBigInteger('item_id')->after('member_id');
            $table->unsignedInteger('item_count')->after('item_id');
        });

        CollectionLog::query()->truncate();
    }
};
