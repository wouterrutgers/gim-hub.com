<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('members', function (Blueprint $table) {
            $table->string('mode', 20)->default('normal')->after('name');
            $table->index(['group_id', 'mode', 'name'], 'members_group_id_mode_name_index');
        });
    }
};
