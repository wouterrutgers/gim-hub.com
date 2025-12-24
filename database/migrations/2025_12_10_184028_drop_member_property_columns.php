<?php

use App\Models\Member;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('members', function (Blueprint $table) {
            foreach (Member::PROPERTY_KEYS as $property) {
                if (Schema::hasColumn('members', $property)) {
                    $table->dropColumn($property);
                    $table->dropColumn("{$property}_last_update");
                }
            }
        });
    }
};
