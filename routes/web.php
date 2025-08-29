<?php

use App\Http\Controllers\GroupController;
use App\Http\Controllers\GroupMemberController;
use App\Http\Controllers\UnauthedController;
use App\Http\Middleware\AuthenticateGroup;
use Illuminate\Support\Facades\Route;

Route::get('/api/ge-prices', [UnauthedController::class, 'getGEPrices']);
Route::get('/api/collection-log-info', [UnauthedController::class, 'collectionLogInfo']);

Route::post('/api/create-group', [GroupController::class, 'createGroup']);

Route::middleware(AuthenticateGroup::class)->prefix('api/group/{group}')->group(function () {
    Route::post('/get-group-data', [GroupController::class, 'getGroup']);
    Route::post('/add-group-member', [GroupMemberController::class, 'addGroupMember']);
    Route::delete('/delete-group-member', [GroupMemberController::class, 'deleteGroupMember']);
    Route::put('/rename-group-member', [GroupMemberController::class, 'renameGroupMember']);
    Route::post('/update-group-member', [GroupMemberController::class, 'updateGroupMember']);
    Route::get('/get-group-data', [GroupMemberController::class, 'getGroupData']);
    Route::get('/get-skill-data', [GroupMemberController::class, 'getSkillData']);
    Route::get('/collection-log', [GroupMemberController::class, 'getCollectionLog']);
    Route::get('/am-i-logged-in', [GroupMemberController::class, 'amILoggedIn']);
    Route::get('/am-i-in-group', [GroupMemberController::class, 'amIInGroup']);
    Route::get('/hiscores', [GroupMemberController::class, 'getHiscores']);
});

Route::fallback(function () {
    return view('index');
});
