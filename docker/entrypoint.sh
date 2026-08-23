#!/bin/bash
set -e

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

export OCTANE_ARGUMENTS="$*"

echo "Starting managed services..."
exec /usr/bin/supervisord --configuration=/etc/supervisor/supervisord.conf
