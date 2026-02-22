<?php

namespace App\Jobs;

use App\Models\Member;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Http;

class SyncMemberSkillsFromHiscores implements ShouldQueue
{
    use Queueable;

    protected const array SKILLS_IN_BACKEND_ORDER = [
        'Agility',
        'Attack',
        'Construction',
        'Cooking',
        'Crafting',
        'Defence',
        'Farming',
        'Firemaking',
        'Fishing',
        'Fletching',
        'Herblore',
        'Hitpoints',
        'Hunter',
        'Magic',
        'Mining',
        'Prayer',
        'Ranged',
        'Runecraft',
        'Slayer',
        'Smithing',
        'Strength',
        'Thieving',
        'Woodcutting',
        'Sailing',
    ];

    public function __construct(protected int $memberId) {}

    public function handle(): void
    {
        $member = Member::with('properties')->find($this->memberId);

        $response = Http::withUserAgent('GIM hub (https://gim-hub.com)')->get(
            'https://secure.runescape.com/m=hiscore_oldschool/index_lite.json?player='.urlencode($member->name)
        );

        if ($response->status() === 404) {
            return;
        }

        $response->throw();

        $hiscoresSkills = $response->collect('skills')->pluck('xp', 'name');

        $skillsProperty = $member->getProperty('skills');
        $existingSkills = $skillsProperty?->value;
        if (! is_array($existingSkills)) {
            return;
        }

        if (count($existingSkills) !== count(static::SKILLS_IN_BACKEND_ORDER)) {
            return;
        }

        $mergedSkills = $existingSkills;

        foreach (static::SKILLS_IN_BACKEND_ORDER as $index => $skill) {
            $hiscoresXP = $hiscoresSkills->get($skill);
            $mergedSkills[$index] = max($mergedSkills[$index], $hiscoresXP);
        }

        if ($mergedSkills === $existingSkills) {
            return;
        }

        $skillsProperty->withoutTimestamps(function () use ($skillsProperty, $mergedSkills) {
            $skillsProperty->update(['value' => $mergedSkills]);
        });
    }
}
