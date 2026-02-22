#!/bin/bash
set -e

function shutdown {
    echo "Shutting down services..."
    kill -TERM $(jobs -p) 2>/dev/null || true
}
trap shutdown SIGTERM SIGINT

echo "Starting application entrypoint..."

if [ ! -s ".env" ]; then
    cat .env.example > .env
    php artisan key:generate --force
fi

if ! grep -q "^APP_KEY=base64:" .env 2>/dev/null; then
    php artisan key:generate --force
fi

php artisan storage:link
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan migrate --force

php artisan schedule:work &

php artisan horizon &

if [ -f "/Caddyfile" ]; then
    echo "Using custom Caddyfile"
    exec php artisan octane:frankenphp --host=0.0.0.0 --port=8000 --caddyfile=/Caddyfile "$@"
else
    echo "Using Octane default configuration"
    exec php artisan octane:frankenphp --host=0.0.0.0 --port=8000 "$@"
fi
