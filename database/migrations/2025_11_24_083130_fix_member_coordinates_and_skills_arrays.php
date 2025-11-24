<?php

use App\Models\Member;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        Member::whereNotNull('coordinates')->orderBy('id')->each(function (Member $member) {
            if (is_array($member->coordinates) && count($member->coordinates) === 3) {
                $member->coordinates = [...$member->coordinates, 0];
                $member->save();
            }
        });

        Member::whereNotNull('skills')->orderBy('id')->each(function (Member $member) {
            if (is_array($member->skills) && count($member->skills) === 23) {
                $member->skills = [...$member->skills, 0];
                $member->save();
            }
        });
    }
};
