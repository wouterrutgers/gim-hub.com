<?php

namespace App\Http\Controllers;

use App\Models\Member;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class MemberPreferencesController extends Controller
{
    public function show(): JsonResponse
    {
        $member = Member::where('group_id', '=', request()->attributes->get('group')->id)
            ->where('id', '=', request()->route('member'))
            ->where('name', '!=', Member::SHARED_MEMBER)
            ->firstOrFail();

        return response()->json(['preferences' => $member->preferences]);
    }

    public function update(): JsonResponse
    {
        $validated = Validator::make(['preferences' => request()->all()], [
            'preferences' => ['required', ['array', 'siteTheme', 'pageBackgroundOpacity', 'enableVirtualLevels', 'enableSkillProgressBars', 'enableGearscapeExport', 'expandPlayerHistory', 'collapseNavigation', 'showItemOwners', 'showActivitySidebar', 'filterActivityDrops', 'pinnedItemIds', 'dismissedPluginWarningVersions', 'seenChangelogIds', 'initialize']],
            'preferences.siteTheme' => ['sometimes', 'string', ['in', 'light', 'dark', 'browntown', 'classic-light', 'classic-dark']],
            'preferences.pageBackgroundOpacity' => ['sometimes', ['integer', 'strict'], ['between', 0, 100]],
            'preferences.enableVirtualLevels' => ['sometimes', ['boolean', 'strict']],
            'preferences.enableSkillProgressBars' => ['sometimes', ['boolean', 'strict']],
            'preferences.enableGearscapeExport' => ['sometimes', ['boolean', 'strict']],
            'preferences.expandPlayerHistory' => ['sometimes', ['boolean', 'strict']],
            'preferences.collapseNavigation' => ['sometimes', ['boolean', 'strict']],
            'preferences.showItemOwners' => ['sometimes', ['boolean', 'strict']],
            'preferences.showActivitySidebar' => ['sometimes', ['boolean', 'strict']],
            'preferences.filterActivityDrops' => ['sometimes', ['boolean', 'strict']],
            'preferences.pinnedItemIds' => ['sometimes', 'array', 'list'],
            'preferences.pinnedItemIds.*' => [['integer', 'strict'], ['min', 1]],
            'preferences.dismissedPluginWarningVersions' => ['sometimes', 'string'],
            'preferences.seenChangelogIds' => ['sometimes', 'array', 'list'],
            'preferences.seenChangelogIds.*' => ['required', 'string', ['min', 1]],
            'preferences.initialize' => ['sometimes', ['boolean', 'strict']],
        ])->validate()['preferences'];

        return DB::transaction(function () use ($validated): JsonResponse {
            $member = Member::where('group_id', '=', request()->attributes->get('group')->id)
                ->where('id', '=', request()->route('member'))
                ->where('name', '!=', Member::SHARED_MEMBER)
                ->lockForUpdate()
                ->firstOrFail();
            $preferences = $member->preferences ?? [];
            $settings = collect($validated)->except(['initialize', 'seenChangelogIds'])->all();
            $preferences = ($validated['initialize'] ?? false)
                ? $preferences + $settings
                : array_replace($preferences, $settings);

            if (array_key_exists('seenChangelogIds', $validated)) {
                $preferences['seenChangelogIds'] = array_values(array_unique([
                    ...($preferences['seenChangelogIds'] ?? []),
                    ...$validated['seenChangelogIds'],
                ]));
            }

            $member->update(['preferences' => $preferences]);

            return response()->json(['preferences' => $member->preferences]);
        });
    }
}
