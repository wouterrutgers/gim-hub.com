<?php

namespace App\Enums;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

enum AggregatePeriod: string
{
    case FiveMinutes = 'five_minutes';
    case Hourly = 'hourly';
    case Daily = 'daily';
    case Monthly = 'monthly';

    public function bucketStart(CarbonInterface $date): CarbonImmutable
    {
        $date = CarbonImmutable::instance($date)->utc();

        return match ($this) {
            self::FiveMinutes => $date->floorMinutes(5)->startOfMinute(),
            self::Hourly => $date->startOfHour(),
            self::Daily => $date->startOfDay(),
            self::Monthly => $date->startOfMonth(),
        };
    }

    public function cutoff(CarbonInterface $date): ?CarbonImmutable
    {
        $date = CarbonImmutable::instance($date);

        return match ($this) {
            self::FiveMinutes => $date->subDays(30),
            self::Hourly => $date->subYear(),
            self::Daily => $date->subMonth(),
            self::Monthly => null,
        };
    }
}
