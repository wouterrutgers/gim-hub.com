<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use InvalidArgumentException;

class SkillStat extends Model
{
    /** @var list<string> */
    public const array SKILLS = [
        'agility',
        'attack',
        'construction',
        'cooking',
        'crafting',
        'defence',
        'farming',
        'firemaking',
        'fishing',
        'fletching',
        'herblore',
        'hitpoints',
        'hunter',
        'magic',
        'mining',
        'prayer',
        'ranged',
        'runecraft',
        'slayer',
        'smithing',
        'strength',
        'thieving',
        'woodcutting',
        'sailing',
    ];

    protected $guarded = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return array_fill_keys(static::SKILLS, 'integer');
    }

    /** @return Attribute<list<int>, list<int>> */
    protected function skills(): Attribute
    {
        return Attribute::make(
            get: fn (): array => array_map(fn (string $skill): int => $this->getAttribute($skill), static::SKILLS),
            set: function (array $skills): array {
                return array_combine(static::SKILLS, $skills);
            },
        );
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(Member::class);
    }
}
