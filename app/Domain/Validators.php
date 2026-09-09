<?php

namespace App\Domain;

class Validators
{
    public static function validName(string $name): bool
    {
        return preg_match('/^[a-zA-Z0-9_\-\s]{1,12}$/', $name);
    }
}
