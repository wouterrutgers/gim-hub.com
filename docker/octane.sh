#!/bin/bash
set -e

php artisan octane:stop --server=frankenphp >/dev/null 2>&1 || true

if [ -f "/Caddyfile" ]; then
    echo "Using custom Caddyfile"
    exec php artisan octane:frankenphp --host=0.0.0.0 --port=8000 --caddyfile=/Caddyfile "$@"
fi

echo "Using Octane default configuration"
exec php artisan octane:frankenphp --host=0.0.0.0 --port=8000 "$@"
