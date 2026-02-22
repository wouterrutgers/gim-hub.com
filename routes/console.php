<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('skills:aggregate')->everyThirtyMinutes();
Schedule::command('skills:retention')->daily();
Schedule::command('hiscores:sync-stale-members')->everyTwoHours();
Schedule::command('horizon:snapshot')->everyFiveMinutes();
