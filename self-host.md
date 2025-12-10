# GIM Hub self‑hosting guide

This guide shows how to run GIM Hub with Laravel Octane and FrankenPHP.

## Prerequisites

- Docker Compose installed

## Quick start

This setup works out-of-the-box with sensible defaults. You only need to create two files: `docker-compose.yml` and `.env`.

1. Create a working directory and enter it

```bash
mkdir gim-hub && cd gim-hub
```

2. Create `docker-compose.yml`

```yaml
services:
  app:
    image: wouterrutgers/gim-hub.com:octane
    ports:
      - "80:8000"
      # Optional: enable HTTPS (requires custom Caddyfile)
      # - "443:443"
      # - "443:443/udp" # For HTTP/3 support
    volumes:
      - ./.env:/app/.env
      # Optional: mount custom Caddyfile for advanced configuration
      # - ./Caddyfile:/Caddyfile:ro
      - caddy_data:/data/caddy
      - caddy_config:/config/caddy
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
  caddy_data:
  caddy_config:
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

4. Start the stack

```bash
docker compose up -d
```

Then open http://localhost (or your domain) in a browser. If you mapped the app to a different port (e.g., 8080), use that in the URL, and ensure `.env` has `APP_URL` set accordingly.

## Configuration notes

- Database defaults (change for production):
  - DB name: `gim`, user: `gim`, password: `secret`, root password: `secret`
- Ports:
  - The app runs on port 8000 inside the container
  - If port 80 is in use on the host, change to e.g. `"8080:8000"` in `docker-compose.yml`
- Laravel Octane with FrankenPHP:
  - High-performance application server with built-in HTTP/2 and HTTP/3 support
  - Uses sensible defaults; no Caddyfile needed for basic usage
  - For custom headers, rate limiting, or HTTPS, mount a custom Caddyfile (see [Advanced Configuration](#advanced-configuration))

## Advanced configuration

### HTTPS setup

To enable HTTPS with automatic certificates, you need to create a custom Caddyfile. FrankenPHP (built on Caddy) automatically generates and renews Let's Encrypt certificates when you specify a domain.

**For HTTP only (e.g., behind a reverse proxy or local development):**

```caddy
{
    auto_https off
    admin off

    frankenphp {
        worker {
            file /app/public/frankenphp-worker.php
            num 2
        }
    }
}

:8000 {
    log {
        level ERROR
    }

    route {
        root * /app/public
        encode zstd br gzip

        # Optional: custom headers
        header X-Custom-Header "value"

        php_server {
            index frankenphp-worker.php
            try_files {path} frankenphp-worker.php
            resolve_root_symlink
        }
    }
}
```

**For HTTPS with automatic certificates:**

```caddy
{
    admin off
    email you@example.com

    frankenphp {
        worker {
            file /app/public/frankenphp-worker.php
            num 2
        }
    }
}

yourdomain.com {
    log {
        level ERROR
    }

    route {
        root * /app/public
        encode zstd br gzip

        # Optional: custom headers
        header X-Custom-Header "value"

        php_server {
            index frankenphp-worker.php
            try_files {path} frankenphp-worker.php
            resolve_root_symlink
        }
    }
}
```

**Update your `.env`:**

```env
APP_URL=https://yourdomain.com
OCTANE_HTTPS=true
```

> **Important:** The volumes `caddy_data` and `caddy_config` are essential for persisting Let's Encrypt certificates across container restarts. Without them, your app will request new certificates on every restart.

> **Note:** Caddy automatically handles certificate generation and renewal when you specify a domain (e.g., `yourdomain.com`) in your Caddyfile. It then proxies internally to the Octane server on port 8000. The `OCTANE_HTTPS=true` setting ensures Laravel generates HTTPS links correctly.

## Troubleshooting

- Container won't start: `docker compose logs app` (or `mysql`)
- Database connection issues: ensure `.env` uses `DB_HOST=mysql` and MySQL is healthy: `docker compose ps mysql`
- Permission issues: ensure `.env` is readable: `chmod 644 .env`
- CSS/JS assets not loading: add `ASSET_URL` to `.env` with the same value as `APP_URL`
- Caddy formatting warning when self hosting: if you see a warning about Caddyfile formatting, you can run:
  ```bash
  docker run --rm -v ./Caddyfile:/tmp/Caddyfile caddy:latest caddy fmt --overwrite /tmp/Caddyfile
  ```
  Then restart the container: `docker compose restart app`

## Security

- Change all default database passwords for production
- For HTTPS, use a custom Caddyfile with your domain (automatic certificates) or place behind a reverse proxy
- Consider Docker secrets for sensitive environment variables
- The application is production ready with Octane providing high performance

## Next steps

- Install the RuneLite "GIM hub" plugin and configure it to use your self‑hosted URL.
