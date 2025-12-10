<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('member_properties', function (Blueprint $table) {
            $table->id();
            $table->foreignId('member_id')->constrained()->cascadeOnDelete();
            $table->string('key')->index();
            $table->json('value')->nullable();
            $table->dateTime('last_update')->nullable();
            $table->timestamps();
            $table->unique(['member_id', 'key']);
        });
    }
};
