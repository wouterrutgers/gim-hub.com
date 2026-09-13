<?php

use App\Models\Group;
use App\Models\Member;

function pluginMember(): Member
{
    $group = Group::create(['name' => 'plugin-group', 'hash' => 'plugin-token']);

    return Member::create(['group_id' => $group->id, 'name' => 'Alice', 'last_online_at' => '2026-09-01 12:00:00']);
}

it('records the reported plugin on rejected uploads without changing game data', function (): void {
    $member = pluginMember();
    cache()->forever('plugin.latest_version', '1.9.1');
    $member->properties()->create(['key' => 'bank', 'value' => [995, 100]]);
    $timestamps = $member->only(['updated_at', 'last_online_at']);
    $this->travel(1)->hours();

    $this->withHeaders(['Authorization' => 'plugin-token', 'User-Agent' => 'RuneLite/1.12.38 GroupIronmenTracker/1.7.0 RuneLite/1.12.38'])
        ->postJson('/api/group/plugin-group/update-group-member', [
            'name' => 'Alice', 'stats' => [90, 99, 50, 70, 8750, 100, 301], 'bank' => [995, 200],
        ])->assertUnprocessable();

    expect($member->fresh()->only(['updated_at', 'last_online_at']))->toEqual($timestamps);
    expect($member->load('properties')->getProperty('bank')->value)->toBe([995, 100]);
    $this->getJson('/api/group/plugin-group/get-group-data?from_time=2099-01-01')
        ->assertJsonPath('0.plugin_status.reason', 'wrong_plugin')
        ->assertJsonPath('0.plugin_status.installed_version', '1.7.0');

    $this->withHeaders(['User-Agent' => 'GIM hub/1.9.1 RuneLite/1.12.38'])
        ->postJson('/api/group/plugin-group/update-group-member', [
            'name' => 'Alice', 'stats' => [90, 99, 50, 70, 8750, 100, 301],
        ])->assertUnprocessable();
    $this->getJson('/api/group/plugin-group/get-group-data?from_time=2099-01-01')
        ->assertJsonPath('0.plugin_status', null);
});

it('accepts uploads and derives version warnings from the latest approved release', function (?string $version, ?string $expectedReason): void {
    pluginMember();
    cache()->forever('plugin.latest_version', '1.9.1');
    $this->withHeaders([
        'Authorization' => 'plugin-token',
        'User-Agent' => is_null($version) ? 'GIM hub/RuneLite/1.12.38' : "GIM hub/{$version} RuneLite/1.12.38",
    ])->postJson('/api/group/plugin-group/update-group-member', ['name' => 'Alice'])
        ->assertSuccessful();
    $status = $this->getJson('/api/group/plugin-group/get-group-data?from_time=2099-01-01')->json('0.plugin_status');

    expect($status['reason'] ?? null)->toBe($expectedReason);
    if (! is_null($expectedReason)) {
        expect($status['installed_version'])->toBe($version);
        expect($status['latest_version'])->toBe('1.9.1');
    }
})->with([
    'older' => ['1.9.0', 'update_available'],
    'unversioned' => [null, 'update_available'],
    'current' => ['1.9.1', null],
    'newer' => ['1.10.0', null],
]);

it('waits for a reporting release and notices new releases without another member upload', function (): void {
    pluginMember();
    $this->withHeaders(['Authorization' => 'plugin-token', 'User-Agent' => 'GIM hub/RuneLite/1.12.38'])
        ->postJson('/api/group/plugin-group/update-group-member', ['name' => 'Alice'])->assertSuccessful();

    cache()->forever('plugin.latest_version', null);
    $this->getJson('/api/group/plugin-group/get-group-data?from_time=2099-01-01')->assertJsonPath('0.plugin_status', null);
    cache()->forever('plugin.latest_version', '1.9.1');
    $this->getJson('/api/group/plugin-group/get-group-data?from_time=2099-01-01')
        ->assertJsonPath('0.plugin_status.reason', 'update_available');
});

it('records warnings only for existing real members of the authenticated group', function (): void {
    $member = pluginMember();
    $otherGroup = Group::create(['name' => 'other-group', 'hash' => 'other-token']);
    $otherMember = Member::create(['group_id' => $otherGroup->id, 'name' => 'Bob']);
    $sharedMember = Member::create(['group_id' => $member->group_id, 'name' => Member::SHARED_MEMBER]);
    $payload = ['stats' => [90, 99, 50, 70, 8750, 100, 301]];

    $this->withHeaders(['Authorization' => 'wrong-token', 'User-Agent' => 'GroupIronmenTracker/1.7.0'])
        ->postJson('/api/group/plugin-group/update-group-member', ['name' => 'Alice', ...$payload])->assertUnauthorized();
    $this->withHeader('Authorization', 'plugin-token')
        ->postJson('/api/group/plugin-group/update-group-member', ['name' => 'Bob', ...$payload])->assertUnprocessable();
    $this->postJson('/api/group/plugin-group/update-group-member', ['name' => Member::SHARED_MEMBER, ...$payload])->assertUnprocessable();

    expect($member->fresh()->plugin_client)->toBeNull();
    expect($otherMember->fresh()->plugin_client)->toBeNull();
    expect($sharedMember->fresh()->plugin_client)->toBeNull();
    $this->getJson('/api/group/plugin-group/get-group-data?from_time=2099-01-01')
        ->assertJsonCount(2)->assertJsonPath('0.plugin_status', null)->assertJsonPath('1.plugin_status', null);
});
