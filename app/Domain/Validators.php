<?php

namespace App\Domain;

use Exception;

class Validators
{
    public static function validName(string $name): bool
    {
        return preg_match('/^[a-zA-Z0-9_\-\s]{1,12}$/', $name);
    }

    public static function validateMemberPropLength(string $propName, ?array $prop, int $minLength, int $maxLength): void
    {
        if (is_null($prop)) {
            return;
        }

        if (count($prop) < $minLength || count($prop) > $maxLength) {
            throw new Exception("$propName length must be between $minLength and $maxLength");
        }
    }
}
