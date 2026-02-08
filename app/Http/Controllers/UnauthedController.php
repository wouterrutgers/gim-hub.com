<?php

namespace App\Http\Controllers;

use App\Domain\GePrices;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use SplFileInfo;

class UnauthedController extends Controller
{
    public function getGEPrices(): JsonResponse
    {
        return response()
            ->json(GePrices::prices())
            ->header('Content-Type', 'application/json')
            ->header('Cache-Control', 'public, max-age=86400');
    }

    public function getChangelog(): JsonResponse
    {
        $entries = collect(File::files(resource_path('changelog')))
            ->filter(fn (SplFileInfo $file) => $file->getExtension() === 'md')
            ->map(function (SplFileInfo $file) {
                $filename = $file->getFilename();

                if (! preg_match('/^(?<date>\d{4}-\d{2}-\d{2})-(?<slug>.+)\.md$/', $filename, $matches)) {
                    return null;
                }

                $markdown = File::get($file->getPathname());

                $title = null;
                if (preg_match('/^\s*#\s+(.+)\s*$/m', $markdown, $titleMatch)) {
                    $title = trim($titleMatch[1]);
                    $markdown = preg_replace('/^\s*#\s+.*\R/', '', $markdown, 1) ?? $markdown;
                }

                return [
                    'id' => "{$matches['date']}-{$matches['slug']}",
                    'date' => $matches['date'],
                    'title' => $title,
                    'html' => Str::markdown($markdown, [
                        'html_input' => 'strip',
                        'allow_unsafe_links' => false,
                    ]),
                ];
            })
            ->filter()
            ->sortByDesc('date')
            ->values();

        return response()
            ->json($entries)
            ->header('Content-Type', 'application/json')
            ->header('Cache-Control', 'public, max-age=300');
    }
}
