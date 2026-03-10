<?php

use App\Models\Member;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('members', function (Blueprint $table) {
            $table->dateTime('last_online_at')->nullable()->index();
        });

        DB::table('member_properties')
            ->selectRaw('member_id, max(updated_at) as last_online_at')
            ->groupBy('member_id')
            ->orderBy('member_id')
            ->cursor()
            ->each(function (object $row) {
                Member::find($row->member_id)?->update(['last_online_at' => $row->last_online_at]);
            });
    }
};
