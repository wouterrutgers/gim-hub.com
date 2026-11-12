<?php

use App\Models\Member;
use App\Models\MemberProperty;
use App\Models\SkillStat;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function (): void {
            $memberIdentifiers = Member::whereNull('plugin_client')
                ->whereNull('plugin_version')
                ->whereHas('properties', function (Builder $query): void {
                    $query->where('key', '=', 'skills')->where('value->[23]', '=', 1);
                })
                ->pluck('id');

            MemberProperty::whereIn('member_id', $memberIdentifiers)
                ->where('key', '=', 'skills')
                ->where('value->[23]', '=', 1)
                ->update(['value' => DB::raw("json_set(value, '$[23]', 0)")]);

            SkillStat::whereIn('member_id', $memberIdentifiers)
                ->where('sailing', '=', 1)
                ->update(['sailing' => 0]);
        });
    }
};
