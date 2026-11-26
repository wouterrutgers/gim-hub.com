<?php

it('shares one target for equivalent items and lets the group remove it', function (): void {
    $group = $this->createSnapshotGroup();
    $url = "/api/group/{$group->name}/wanted-items";
    $headers = ['Authorization' => $group->hash];

    $this->putJson($url, ['item_id' => 20716, 'target_quantity' => 5, 'expected_quantity' => null], $headers)->assertOk();
    $this->putJson($url, ['item_id' => 20714, 'target_quantity' => 3, 'expected_quantity' => 5], $headers)->assertOk();
    $this->getJson($url, $headers)->assertOk()->assertExactJson([
        ['item_id' => 20714, 'target_quantity' => 3],
    ]);

    $this->deleteJson("{$url}/20716", ['expected_quantity' => 3], $headers)->assertNoContent();
    $this->getJson($url, $headers)->assertOk()->assertExactJson([]);
});

it('keeps previously saved variants editable and gives exact removal its own target', function (): void {
    $group = $this->createSnapshotGroup();
    $url = "/api/group/{$group->name}/wanted-items";
    $headers = ['Authorization' => $group->hash];
    $group->wantedItems()->forceCreate(['item_id' => 25376, 'target_quantity' => 2]);

    $this->putJson($url, ['item_id' => 11920, 'target_quantity' => 3, 'expected_quantity' => null], $headers)
        ->assertConflict()->assertJsonPath('item_id', 25376);
    $this->putJson($url, [
        'item_id' => 25376, 'target_quantity' => 3, 'expected_quantity' => 2, 'exact_item_id' => true,
    ], $headers)->assertOk()->assertJsonPath('item_id', 25376);

    $group->wantedItems()->forceCreate(['item_id' => 11920, 'target_quantity' => 3]);
    $removal = ['expected_quantity' => 3, 'exact_item_id' => true];
    $this->deleteJson("$url/25376", $removal, $headers)->assertNoContent();
    $this->deleteJson("$url/25376", $removal, $headers)->assertNoContent();
    $this->getJson($url, $headers)->assertOk()->assertExactJson([
        ['item_id' => 11920, 'target_quantity' => 3],
    ]);
});

it('isolates wanted item reads and writes to the authenticated group', function (): void {
    $group = $this->createSnapshotGroup();
    $otherGroup = $this->createSnapshotGroup('other-group');
    $url = "/api/group/{$group->name}/wanted-items";
    $otherUrl = "/api/group/{$otherGroup->name}/wanted-items";
    $headers = ['Authorization' => $group->hash];
    $otherHeaders = ['Authorization' => $otherGroup->hash];
    $goal = ['item_id' => 11889, 'target_quantity' => 5];

    $this->putJson($url, [...$goal, 'expected_quantity' => null], $headers)->assertOk();
    $this->getJson($url, $otherHeaders)->assertUnauthorized();
    $this->getJson($otherUrl, $otherHeaders)->assertOk()->assertExactJson([]);
    $this->putJson($otherUrl, ['item_id' => 11889, 'target_quantity' => 1, 'expected_quantity' => null], $otherHeaders)->assertOk();
    $this->deleteJson("{$otherUrl}/11889", ['expected_quantity' => 1], $otherHeaders)->assertNoContent();

    $this->getJson($url, $headers)->assertOk()->assertExactJson([$goal]);
});

it('returns 422 for an unknown item or invalid target quantity without saving a goal', function (): void {
    $group = $this->createSnapshotGroup();
    $url = "/api/group/{$group->name}/wanted-items";
    $headers = ['Authorization' => $group->hash];

    $this->putJson($url, ['item_id' => 999999, 'target_quantity' => 5, 'expected_quantity' => null], $headers)
        ->assertUnprocessable()->assertJsonValidationErrors('item_id');
    $this->putJson($url, ['item_id' => 27358, 'target_quantity' => 5, 'expected_quantity' => null], $headers)
        ->assertUnprocessable()->assertJsonValidationErrors('item_id');
    $this->putJson($url, ['item_id' => 11889, 'target_quantity' => 0, 'expected_quantity' => null], $headers)
        ->assertUnprocessable()->assertJsonValidationErrors('target_quantity');

    $this->getJson($url, $headers)->assertOk()->assertExactJson([]);
});

it('returns a conflict before a stale save or removal can overwrite a teammate’s target', function (): void {
    $group = $this->createSnapshotGroup();
    $url = "/api/group/{$group->name}/wanted-items";
    $headers = ['Authorization' => $group->hash];
    $goal = ['item_id' => 11889, 'target_quantity' => 5];

    $this->putJson($url, [...$goal, 'expected_quantity' => null], $headers)->assertOk();
    $this->putJson($url, [...$goal, 'target_quantity' => 7, 'expected_quantity' => 5], $headers)->assertOk();

    $this->putJson($url, [...$goal, 'target_quantity' => 9, 'expected_quantity' => 5], $headers)
        ->assertConflict()->assertJsonPath('target_quantity', 7);
    $this->deleteJson("{$url}/11889", ['expected_quantity' => 5], $headers)
        ->assertConflict()->assertJsonPath('target_quantity', 7);
    $this->getJson($url, $headers)->assertOk()->assertExactJson([[...$goal, 'target_quantity' => 7]]);
});
