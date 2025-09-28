<?php

namespace App\Http\Controllers;

use App\Domain\Validators;
use App\Models\Group;
use App\Models\Member;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Ramsey\Uuid\Uuid;

class GroupController extends Controller
{
    public function createGroup(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string',
            'member_names' => 'required|array',
        ]);

        foreach (array_filter($validated['member_names']) as $memberName) {
            if (! Validators::validName($memberName)) {
                return response()->json([
                    'error' => "Invalid member name: {$memberName}",
                ], 422);
            }
        }

        $group = Group::create([
            'name' => $validated['name'],
            'hash' => Uuid::uuid4(),
        ]);

        Member::create([
            'group_id' => $group->id,
            'name' => Member::SHARED_MEMBER,
        ]);

        foreach (array_filter($validated['member_names']) as $memberName) {
            Member::create([
                'group_id' => $group->id,
                'name' => $memberName,
            ]);
        }

        return response()->json([
            'name' => $validated['name'],
            'token' => $group->hash,
        ], 201);
    }
}
