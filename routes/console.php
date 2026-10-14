<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('skills:aggregate')->everyFiveMinutes()->withoutOverlapping();
Schedule::command('skills:retention')->daily();
Schedule::command('activity:prune')->daily();
Schedule::command('horizon:snapshot')->everyFiveMinutes();
Schedule::command('plugin:refresh-release')->hourly();
