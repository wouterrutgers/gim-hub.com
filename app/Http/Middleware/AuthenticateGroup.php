<?php

namespace App\Http\Middleware;

use App\Models\Group;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateGroup
{
    public function __construct(
        protected RateLimiter $rateLimiter
    ) {}

    public function handle(Request $request, Closure $next): mixed
    {
        $routeGroup = $request->route('group');

        if (! $routeGroup) {
            return $this->badRequest('Missing group name from request');
        }

        if ($routeGroup === '_') {
            return $next($request);
        }

        $token = $request->header('Authorization');

        if (! $token) {
            return $this->badRequest('Authorization header missing from request');
        }

        $group = Group::where('name', '=', $routeGroup)
            ->where('hash', '=', $token)
            ->first();

        if (! $group) {
            return $this->handleFailedAuth($request, $routeGroup, $token);
        }

        app()->instance('group', $group);

        return $next($request);
    }

    protected function badRequest(string $message): JsonResponse
    {
        return response()->json([
            'message' => $message,
        ], Response::HTTP_BAD_REQUEST);
    }

    protected function unauthorized(): JsonResponse
    {
        return response()->json([
            'message' => 'Unauthorized',
        ], Response::HTTP_UNAUTHORIZED);
    }

    protected function handleFailedAuth(Request $request, string $routeGroup, string $token): JsonResponse
    {
        $key = "auth_attempts:{$request->ip()}:{$routeGroup}";

        if ($this->rateLimiter->tooManyAttempts($key, 5)) {
            $seconds = $this->rateLimiter->availableIn($key);

            return response()->json([
                'message' => 'Too many authentication attempts',
                'retry_after' => $seconds,
            ], Response::HTTP_TOO_MANY_REQUESTS);
        }

        $this->rateLimiter->hit($key, 300);

        return $this->unauthorized();
    }
}
