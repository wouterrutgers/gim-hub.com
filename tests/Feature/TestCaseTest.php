<?php

use Illuminate\Support\Facades\Http;

it('prevents stray HTTP requests by default', function () {
    expect(Http::preventingStrayRequests())->toBeTrue();
});
