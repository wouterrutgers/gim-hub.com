<?php

namespace App\Domain;

use App\Models\Member;

class MemberPlugin
{
    public static function validVersion(?string $version): bool
    {
        return ! is_null($version) && strlen($version) <= 32 && preg_match('/\A\d+\.\d+\.\d+\z/', $version) === 1;
    }

    public static function observe(): void
    {
        if (! is_string(request()->input('name')) || is_null(request()->attributes->get('group'))) {
            return;
        }

        if (preg_match('/(?:^|\s)GroupIronmenTracker\/([^\s]+)/', request()->userAgent() ?? '', $matches) === 1) {
            $pluginClient = 'group-ironmen-tracker';
        } elseif (preg_match('/(?:^|\s)GIM hub\/([^\s]+)/', request()->userAgent() ?? '', $matches) === 1) {
            $pluginClient = 'gim-hub';
        } else {
            return;
        }

        Member::withoutTimestamps(function () use ($pluginClient, $matches): void {
            Member::where('group_id', '=', request()->attributes->get('group')->id)
                ->where('name', '=', request()->input('name'))
                ->where('name', '!=', Member::SHARED_MEMBER)
                ->update([
                    'plugin_client' => $pluginClient,
                    'plugin_version' => static::validVersion($matches[1]) ? $matches[1] : null,
                ]);
        });
    }

    /** @return array{reason: string, installed_version: ?string, latest_version: ?string}|null */
    public static function status(Member $member, ?string $latestVersion): ?array
    {
        if ($member->name === Member::SHARED_MEMBER) {
            return null;
        }

        if ($member->plugin_client === 'group-ironmen-tracker') {
            $reason = 'wrong_plugin';
        } elseif ($member->plugin_client === 'gim-hub'
            && ! is_null($latestVersion)
            && (is_null($member->plugin_version) || version_compare($member->plugin_version, $latestVersion, '<'))) {
            $reason = 'update_available';
        } else {
            return null;
        }

        return [
            'reason' => $reason,
            'installed_version' => $member->plugin_version,
            'latest_version' => $latestVersion,
        ];
    }
}
