<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Member extends Model
{
    protected $guarded = [];

    public const SHARED_MEMBER = '@SHARED';

    public const PROPERTY_KEYS = [
        'stats', 'coordinates', 'skills', 'quests', 'inventory', 'equipment',
        'bank', 'rune_pouch', 'seed_vault', 'potion_storage', 'poh_costume_room', 'quiver',
        'diary_vars', 'interacting',
    ];

    public function getProperty(string $key): ?MemberProperty
    {
        return $this->properties->firstWhere('key', '=', $key);
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }

    public function properties(): HasMany
    {
        return $this->hasMany(MemberProperty::class);
    }

    public function collectionLogs(): HasMany
    {
        return $this->hasMany(CollectionLog::class);
    }

    public function skillStats(): HasMany
    {
        return $this->hasMany(SkillStat::class);
    }
}
