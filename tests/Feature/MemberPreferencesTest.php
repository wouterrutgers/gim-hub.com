<?php

use App\Models\Member;

it('requires the group token for preference reads and writes', function (): void {
    $group = $this->createSnapshotGroup();
    $member = $this->createCompleteSnapshotMember($group);

    $this->getJson("/api/group/{$group->name}/members/{$member->id}/preferences")->assertBadRequest();
    $this->withHeader('Authorization', 'invalid-token')
        ->patchJson("/api/group/{$group->name}/members/{$member->id}/preferences", ['siteTheme' => 'dark'])
        ->assertUnauthorized();

    expect($member->fresh()->preferences)->toBeNull();
});

it('does not expose or update preferences for another group or shared storage', function (): void {
    $group = $this->createSnapshotGroup();
    $otherGroup = $this->createSnapshotGroup('other-group');
    $otherMember = $this->createCompleteSnapshotMember($otherGroup);
    $sharedMember = Member::create(['group_id' => $group->id, 'name' => Member::SHARED_MEMBER]);

    $this->withHeader('Authorization', $group->hash);

    foreach ([$otherMember, $sharedMember] as $member) {
        $this->getJson("/api/group/{$group->name}/members/{$member->id}/preferences")->assertNotFound();
        $this->patchJson("/api/group/{$group->name}/members/{$member->id}/preferences", ['siteTheme' => 'dark'])
            ->assertNotFound();

        expect($member->fresh()->preferences)->toBeNull();
    }
});

it('initializes missing preferences and merges later changes without losing acknowledged changelogs', function (): void {
    $group = $this->createSnapshotGroup();
    $member = $this->createCompleteSnapshotMember($group);
    $preferences = [
        'siteTheme' => 'classic-dark',
        'pageBackgroundOpacity' => 90,
        'enableVirtualLevels' => false,
        'enableSkillProgressBars' => true,
        'enableGearscapeExport' => false,
        'expandPlayerHistory' => true,
        'collapseNavigation' => false,
        'showItemOwners' => true,
        'showActivitySidebar' => true,
        'filterActivityDrops' => false,
        'seenChangelogIds' => ['2026-11-01-first'],
    ];

    $this->withHeader('Authorization', $group->hash)
        ->getJson("/api/group/{$group->name}/members/{$member->id}/preferences")
        ->assertSuccessful()->assertJsonPath('preferences', null);
    $this->patchJson("/api/group/{$group->name}/members/{$member->id}/preferences", [
        ...$preferences,
        'initialize' => true,
    ])->assertSuccessful()->assertJsonPath('preferences', $preferences);

    $preferences['pinnedItemIds'] = [4151];
    $preferences['dismissedPluginWarningVersions'] = '["1.15.0"]';
    $this->patchJson("/api/group/{$group->name}/members/{$member->id}/preferences", [
        'initialize' => true,
        'siteTheme' => 'light',
        'pinnedItemIds' => [4151],
        'dismissedPluginWarningVersions' => '["1.15.0"]',
        'seenChangelogIds' => ['2026-11-02-second'],
    ])->assertSuccessful()->assertJsonPath('preferences.siteTheme', 'classic-dark');
    $this->patchJson("/api/group/{$group->name}/members/{$member->id}/preferences", [
        'enableGearscapeExport' => true,
        'collapseNavigation' => true,
        'seenChangelogIds' => ['2026-11-01-first'],
    ])->assertSuccessful();

    $preferences['enableGearscapeExport'] = true;
    $preferences['collapseNavigation'] = true;
    $preferences['seenChangelogIds'][] = '2026-11-02-second';
    $this->getJson("/api/group/{$group->name}/members/{$member->id}/preferences")
        ->assertSuccessful()->assertJsonPath('preferences', $preferences);
    expect($member->fresh()->preferences)->toBe($preferences);
});

it('does not change gameplay freshness when preferences are saved', function (): void {
    $this->freezeTime();
    $group = $this->createSnapshotGroup();
    $member = $this->createCompleteSnapshotMember($group);
    $this->withHeader('Authorization', $group->hash);
    $lastUpdated = $this->getJson("/api/group/{$group->name}/get-group-data?from_time=2000-01-01")
        ->assertSuccessful()->json('0.last_updated');
    $this->travel(1)->hours();

    $this->patchJson("/api/group/{$group->name}/members/{$member->id}/preferences", ['siteTheme' => 'dark'])
        ->assertSuccessful();

    $this->getJson("/api/group/{$group->name}/get-group-data?from_time=2000-01-01")
        ->assertSuccessful()->assertJsonPath('0.last_updated', $lastUpdated);
});

it('rejects invalid preference values without changing saved preferences', function (): void {
    $group = $this->createSnapshotGroup();
    $member = $this->createCompleteSnapshotMember($group);
    $member->update(['preferences' => ['siteTheme' => 'dark']]);

    $this->withHeader('Authorization', $group->hash)
        ->patchJson("/api/group/{$group->name}/members/{$member->id}/preferences", [
            'siteTheme' => 'system',
            'pageBackgroundOpacity' => 101,
            'enableVirtualLevels' => 'false',
            'pinnedItemIds' => ['4151'],
            'seenChangelogIds' => [null],
        ])->assertUnprocessable()->assertInvalid([
            'preferences.siteTheme',
            'preferences.pageBackgroundOpacity',
            'preferences.enableVirtualLevels',
            'preferences.pinnedItemIds.0',
            'preferences.seenChangelogIds.0',
        ]);

    expect($member->fresh()->preferences)->toBe(['siteTheme' => 'dark']);
});

it('rejects unknown preference fields', function (): void {
    $group = $this->createSnapshotGroup();
    $member = $this->createCompleteSnapshotMember($group);

    $this->withHeader('Authorization', $group->hash)
        ->patchJson("/api/group/{$group->name}/members/{$member->id}/preferences", [
            'siteTheme' => 'dark',
            'group_id' => $group->id,
        ])->assertUnprocessable()->assertInvalid(['preferences']);

    expect($member->fresh()->preferences)->toBeNull();
});
