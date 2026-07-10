<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('skills:aggregate')->everyThirtyMinutes();
Schedule::command('skills:retention')->daily();
Schedule::command('member-snapshots:create')->everyFourHours();
Schedule::command('horizon:snapshot')->everyFiveMinutes();
