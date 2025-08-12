FROM php:8.4-fpm-alpine AS base

WORKDIR /var/www

RUN apk add --no-cache \
    curl \
    bash \
    libzip-dev \
    oniguruma-dev \
    zip \
    unzip \
    sqlite-dev \
    sqlite \
    && curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/cfg/gpg/gpg.155B6D79CA56EA34.key' > /etc/apk/keys/caddy.key \
    && echo "https://dl.cloudsmith.io/public/caddy/stable/alpine/any-version/main" >> /etc/apk/repositories \
    && apk add --no-cache caddy

RUN docker-php-ext-install -j$(nproc) \
    pdo_mysql \
    pdo_sqlite \
    bcmath \
    zip \
    opcache

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

FROM base AS deps
WORKDIR /var/www

COPY composer.json composer.lock ./

RUN --mount=type=cache,target=/root/.composer/cache \
    composer install --no-dev --prefer-dist --no-interaction --classmap-authoritative --no-scripts

FROM node:24-alpine AS assets
WORKDIR /app

COPY package.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm install

COPY build.js ./
COPY resources ./resources
COPY public ./public

RUN npm run bundle

FROM base AS prod
WORKDIR /var/www

COPY docker/php/php.ini $PHP_INI_DIR/conf.d/custom.ini
COPY docker/php/opcache.ini $PHP_INI_DIR/conf.d/opcache.ini
COPY docker/caddyfile /etc/caddy/Caddyfile
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

COPY --chown=www-data:www-data . .

COPY --from=deps /var/www/vendor ./vendor

COPY --from=assets /app/public/app.js /var/www/public/app.js
COPY --from=assets /app/public/data /var/www/public/data
COPY --from=assets /app/resources/views/index.blade.php /var/www/resources/views/index.blade.php

RUN chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

RUN rm -rf .git*

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

FROM prod AS final
