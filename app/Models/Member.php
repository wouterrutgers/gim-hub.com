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
        'bank', 'rune_pouch', 'seed_vault', 'potion_storage', 'poh_costume_room',
        'plank_sack', 'master_scroll_book', 'essence_pouches', 'tackle_box',
        'coal_bag',
        'fish_barrel',
        'quiver', 'diary_vars', 'interacting',
    ];

    // Keys that represent a partial view of an item collection, like items that the plugin has seen removed from an unopened tackle box.
    public const PARTIAL_PROPERTY_KEYS = [
        'bank' => 'bank_partial',
        'tackle_box' => 'tackle_box_partial',
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
