# GIM Hub self‑hosting guide

This guide shows how to run GIM Hub locally. You will create three small files next to each other and start the stack.

## Prerequisites

- Docker Compose installed

## Quick start

1. Create a working directory and enter it

```bash
mkdir gim-hub && cd gim-hub
```

2. Create `docker-compose.yml`

```yaml
services:
  app:
    image: wouterrutgers/gim-hub.com:latest
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./.env:/var/www/.env
      - ./caddyfile:/etc/caddy/Caddyfile:ro
    depends_on:
      mysql:
        condition: service_healthy

  mysql:
    image: mysql:8.4
    environment:
      MYSQL_DATABASE: gim
      MYSQL_USER: gim
      MYSQL_PASSWORD: secret
      MYSQL_ROOT_PASSWORD: secret
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD-SHELL", "mysqladmin ping -h 127.0.0.1 -uroot -p$$MYSQL_ROOT_PASSWORD || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 10s

volumes:
  mysql_data:
```

3. Create `.env` (app key will be generated automatically)

```env
APP_NAME="GIM Hub"
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_URL=http://localhost

DB_CONNECTION=mysql
DB_HOST=mysql
DB_PORT=3306
DB_DATABASE=gim
DB_USERNAME=gim
DB_PASSWORD=secret

SESSION_DRIVER=database
QUEUE_CONNECTION=database
CACHE_STORE=file
```

4. Create `caddyfile`

- Without HTTPS (in case of a reverse proxy handling HTTPS):

```caddy
{
    auto_https off
    admin off
}

:80 {
    root * /var/www/public

    php_fastcgi localhost:9000 {
        root /var/www/public
    }

    @dotfiles { path */.* }
    respond @dotfiles 404

    header {
        X-XSS-Protection "1; mode=block"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "geolocation=(), microphone=(), camera=()"
        -Server
    }

    @static { path *.ico *.css *.js *.gif *.webp *.avif *.jpg *.jpeg *.png *.svg *.woff *.woff2 }
    header @static Cache-Control "public, max-age=31536000, immutable"

    file_server
    try_files {path} {path}/ /index.php?{query}
    encode gzip zstd
}
```

- For with HTTPS (automatic certificates):
  - Change `APP_URL` in `.env` to your `https://domain.example`.
  - Replace the `caddyfile` with:

```caddy
{
    admin off
    # optional: email you@example.com
}

domain.example {
    root * /var/www/public

    php_fastcgi localhost:9000 {
        root /var/www/public
    }

    @dotfiles { path */.* }
    respond @dotfiles 404

    header {
        X-XSS-Protection "1; mode=block"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "geolocation=(), microphone=(), camera=()"
        -Server
    }

    @static { path *.ico *.css *.js *.gif *.webp *.avif *.jpg *.jpeg *.png *.svg *.woff *.woff2 }
    header @static Cache-Control "public, max-age=31536000, immutable"

    file_server
    try_files {path} {path}/ /index.php?{query}
    encode gzip zstd
}
```

5. Start the stack

```bash
docker compose up -d
```

Then open http://localhost (or your domain) in a browser. If you mapped the app to a different port (e.g., 8080), use that in the URL, and ensure `.env` has `APP_URL` set accordingly.

## Configuration notes

- Database defaults (change for production):
  - DB name: `gim`, user: `gim`, password: `secret`, root password: `secret`
- Ports:
  - If 80/443 are in use, change the app ports to e.g. `"8080:80"` and/or `"8443:443"` in `docker-compose.yml`, and update how you access the site.

## Troubleshooting

- Container won't start: `docker compose logs app` (or `mysql`)
- Database connection issues: ensure `.env` uses `DB_HOST=mysql` and MySQL is healthy: `docker compose ps mysql`
- Permission issues: ensure `.env` and `caddyfile` exist and are readable: `chmod 644 .env caddyfile`

## Security

- Change all default database passwords for production.
- If exposing 443, use the HTTPS Caddyfile and point DNS to your server.
- Consider Docker secrets or `.env` per environment.

## Next steps

- Install the RuneLite “GIM Hub” plugin and configure it to use your self‑hosted URL.
