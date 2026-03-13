<?php

use App\Providers\AppServiceProvider;
use App\Providers\HorizonServiceProvider;
use Bugsnag\BugsnagLaravel\BugsnagServiceProvider;

return [
    AppServiceProvider::class,
    HorizonServiceProvider::class,
    BugsnagServiceProvider::class,
];
