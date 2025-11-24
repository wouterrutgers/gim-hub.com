FROM dunglas/frankenphp:php8.4 AS base

RUN install-php-extensions \
    pcntl \
    pdo_mysql \
    pdo_sqlite \
    bcmath \
    zip \
    opcache

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /app

FROM base AS dependencies

COPY composer.json composer.lock ./

RUN --mount=type=cache,target=/root/.composer/cache \
    composer install --no-dev --prefer-dist --no-interaction --classmap-authoritative --no-scripts

FROM node:25-alpine AS assets
WORKDIR /build

COPY package.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm install

COPY vite.config.mts ./
COPY resources ./resources
COPY public ./public

RUN npm run bundle

FROM base AS production

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

COPY . /app

COPY --from=dependencies /app/vendor ./vendor

COPY --from=assets /build/public/build /app/public/build
COPY --from=assets /build/public/data /app/public/data
COPY --from=assets /build/public/image-chunks /app/public/image-chunks
COPY --from=assets /build/resources/views/index.blade.php /app/resources/views/index.blade.php

RUN composer dump-autoload --optimize --classmap-authoritative --no-dev --no-interaction

RUN chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

RUN rm -rf .git*

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/up || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
