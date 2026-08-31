<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Group extends Model
{
    protected $guarded = [];

    public function members(): HasMany
    {
        return $this->hasMany(Member::class);
    }

    public function chatMessages(): HasMany
    {
        return $this->hasMany(GroupChatMessage::class);
    }
}
