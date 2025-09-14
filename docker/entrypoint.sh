#!/bin/bash
set -e

function shutdown {
    echo "Shutting down services..."
    kill -TERM $(jobs -p) 2>/dev/null || true
    kill -QUIT $(cat /var/run/php-fpm.pid) 2>/dev/null || true
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
php artisan update-collection-pages

php-fpm -D

php artisan schedule:work &

exec caddy run --config /etc/caddy/Caddyfile
