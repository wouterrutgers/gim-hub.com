<?php

namespace App\Http\Controllers;

use App\Domain\Validators;
use App\Models\Group;
use App\Models\Member;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Ramsey\Uuid\Uuid;

class GroupController extends Controller
{
    public function createGroup(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string',
            'member_names' => 'required|array',
        ]);

        $memberNames = collect($validated['member_names'])
            ->filter()
            ->values();

        $memberColorHues = $memberNames
            ->sort(fn (string $firstMemberName, string $secondMemberName): int => strcasecmp($firstMemberName, $secondMemberName))
            ->values()
            ->mapWithKeys(fn (string $memberName, int $index): array => [
                $memberName => Member::DEFAULT_COLOR_HUES[$index] ?? 0,
            ]);

        foreach ($memberNames as $memberName) {
            if (! Validators::validName($memberName)) {
                return response()->json([
                    'error' => "Invalid member name: {$memberName}",
                ], 422);
            }
        }

        $token = Uuid::uuid4()->toString();

        DB::transaction(function () use ($validated, $token, $memberNames, $memberColorHues) {
            $group = Group::create([
                'name' => $validated['name'],
                'hash' => $token,
            ]);

            Member::create([
                'group_id' => $group->id,
                'name' => Member::SHARED_MEMBER,
            ]);

            foreach ($memberNames as $memberName) {
                Member::create([
                    'group_id' => $group->id,
                    'name' => $memberName,
                    'color_hue_degrees' => $memberColorHues[$memberName],
                ]);
            }
        });

        return response()->json([
            'name' => $validated['name'],
            'token' => $token,
        ], 201);
    }
}
