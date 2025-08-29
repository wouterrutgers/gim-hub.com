<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Member extends Model
{
    protected $guarded = [];

    protected $casts = [
        'stats' => 'array',
        'stats_last_update' => 'datetime',
        'coordinates' => 'array',
        'coordinates_last_update' => 'datetime',
        'skills' => 'array',
        'skills_last_update' => 'datetime',
        'quests' => 'array',
        'quests_last_update' => 'datetime',
        'inventory' => 'array',
        'inventory_last_update' => 'datetime',
        'equipment' => 'array',
        'equipment_last_update' => 'datetime',
        'rune_pouch' => 'array',
        'rune_pouch_last_update' => 'datetime',
        'bank' => 'array',
        'bank_last_update' => 'datetime',
        'seed_vault' => 'array',
        'seed_vault_last_update' => 'datetime',
        'interacting' => 'array',
        'interacting_last_update' => 'datetime',
        'diary_vars' => 'array',
        'diary_vars_last_update' => 'datetime',
    ];

    public const SHARED_MEMBER = '@SHARED';

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
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
