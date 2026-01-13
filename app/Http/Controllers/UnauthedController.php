<?php

namespace App\Http\Controllers;

use App\Domain\GePrices;
use Illuminate\Http\JsonResponse;

class UnauthedController extends Controller
{
    public function getGEPrices(): JsonResponse
    {
        return response()
            ->json(GePrices::prices())
            ->header('Content-Type', 'application/json')
            ->header('Cache-Control', 'public, max-age=86400');
    }
}
