<?php

namespace App\Http\Controllers;

use App\Models\GroupChatMessage;
use App\Models\Member;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GroupChatController extends Controller
{
    public function relayMessage(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string',
            'message' => 'required|string|max:500',
            'sent_at' => 'required|date',
        ]);

        $group = $request->attributes->get('group');
        $groupId = $group->id;

        $member = Member::where('group_id', '=', $groupId)
            ->where('name', '=', $validated['name'])
            ->first();

        if (! $member) {
            return response()->json([
                'error' => 'Player is not a member of this group',
            ], 401);
        }

        if (! $member->chat_relay_enabled) {
            return response()->json([
                'error' => 'Chat relay is not enabled for this member',
            ], 403);
        }

        GroupChatMessage::create([
            'group_id' => $groupId,
            'member_id' => $member->id,
            'sender_name' => $member->name,
            'message' => $validated['message'],
            'sent_at' => Carbon::parse($validated['sent_at']),
        ]);

        return response()->json(null, 201);
    }

    public function getMessages(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'after_id' => 'nullable|integer|min:0',
        ]);

        $afterId = $validated['after_id'] ?? 0;
        $group = $request->attributes->get('group');
        $groupId = $group->id;

        $retentionDays = max(1, min(7, (int) env('CHAT_RETENTION_DAYS', 7)));
        $cutoff = Carbon::now()->subDays($retentionDays);

        $messages = GroupChatMessage::where('group_id', '=', $groupId)
            ->where('id', '>', (int) $afterId)
            ->where('sent_at', '>=', $cutoff)
            ->with('member:id,color_hue_degrees')
            ->orderBy('sent_at')
            ->orderBy('id')
            ->limit(100)
            ->get()
            ->map(function (GroupChatMessage $msg) {
                return [
                    'id' => $msg->id,
                    'sender_name' => $msg->sender_name,
                    'message' => $msg->message,
                    'sent_at' => Carbon::make($msg->sent_at)->toIso8601ZuluString(),
                    'color_hue_degrees' => $msg->member?->color_hue_degrees,
                ];
            });

        return response()->json($messages);
    }
}
