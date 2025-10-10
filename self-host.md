# GIM Hub self‑hosting guide

This guide shows how to run GIM Hub with Laravel Octane and FrankenPHP for improved performance.

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
    volumes:
      - ./.env:/app/.env
      # Optional: mount custom Caddyfile for advanced configuration
      # - ./Caddyfile:/Caddyfile:ro
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

### Custom Caddyfile

If you need custom Caddy configuration, create a `Caddyfile` and mount it in `docker-compose.yml`:

```yaml
volumes:
  - ./.env:/app/.env
  - ./Caddyfile:/Caddyfile:ro
```

**Important:** your Caddyfile must include the `frankenphp` directive in the global block:

```caddy
{
    auto_https off
    admin off

    frankenphp  # Required for Octane!
}

:8000 {
    # Your custom configuration here
    header X-Custom-Header "value"

    encode gzip zstd
}
```

For HTTPS with automatic certificates, you need to update both the Caddyfile and docker-compose.yml:

**Caddyfile:**

```caddy
{
    admin off
    email you@example.com

    frankenphp  # Required for Octane!
}

yourdomain.com {
    # Your custom configuration here
    encode gzip zstd

    # Proxy to the Octane server
    reverse_proxy localhost:8000
}
```

**docker-compose.yml:**

```yaml
services:
  app:
    image: wouterrutgers/gim-hub.com:octane
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp" # For HTTP/3 support
    volumes:
      - ./.env:/app/.env
      - ./Caddyfile:/Caddyfile:ro
```

This setup allows Caddy to handle HTTPS on ports 80/443 and proxy to the Octane server running on port 8000.

**Alternative: Use Octane's built-in HTTPS support (no custom Caddyfile needed)**

Octane with FrankenPHP has native HTTPS support. To use it, pass the `--https` flag to the container:

```yaml
services:
  app:
    image: wouterrutgers/gim-hub.com:octane
    command: ["--https"]
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp" # For HTTP/3 support
    volumes:
      - ./.env:/app/.env
    depends_on:
      mysql:
        condition: service_healthy

  mysql:
    # ... same as before
```

Then set `OCTANE_HTTPS=true` in your `.env` to ensure Laravel generates HTTPS links. Access your application via `https://localhost` (note: you may need to accept a self-signed certificate in development).

> **Note:** When using `--https` with FrankenPHP, the server automatically listens on ports 80 (HTTP), 443 (HTTPS/HTTP/2), and 443/udp (HTTP/3), regardless of the `--port` flag value.

## Migrating from PHP-FPM to Octane

If you're upgrading from `wouterrutgers/gim-hub.com:latest` (PHP-FPM) to `:octane`:

1. **Update image tag** in `docker-compose.yml` from `:latest` to `:octane`
2. **Update port mapping** in `docker-compose.yml`: Change from `"80:80"` to `"80:8000"` (the internal port changed from 80 to 8000)
3. **Update .env volume mount path**: Change from `/var/www/.env` to `/app/.env` (the working directory changed)
4. **Update or remove Caddyfile mount** in `docker-compose.yml`:
   - **Option A (Recommended):** Remove the Caddyfile mount entirely - Octane provides sensible defaults
   - **Option B:** Update your Caddyfile to work with Octane (see example below)
5. **Update Caddyfile mount path** (if keeping custom Caddyfile): Change from `/etc/caddy/Caddyfile` to `/Caddyfile`
6. **Update Caddyfile port** (if using custom Caddyfile): Change from `:80` to `:8000` in your Caddyfile

### Option A: remove Caddyfile (recommended)

Simply remove or comment out the Caddyfile volume mount in `docker-compose.yml`:

```yaml
volumes:
  - ./.env:/app/.env
  # - ./Caddyfile:/Caddyfile:ro  # Remove this line
```

Octane will use sensible defaults with HTTP/2, HTTP/3, gzip compression, and security headers.

### Option B: update Caddyfile

If you need custom configuration, update your Caddyfile:

Example migration of a custom Caddyfile:

**Before (PHP-FPM):**

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
    file_server
}
```

**After (Octane):**

```caddy
{
    auto_https off
    admin off

    frankenphp  # Add this!
}

:8000 {
    # Remove root, php_fastcgi, and file_server
    # FrankenPHP handles everything automatically
    # Just add your custom directives
}
```

## Troubleshooting

- Container won't start: `docker compose logs app` (or `mysql`)
- Database connection issues: ensure `.env` uses `DB_HOST=mysql` and MySQL is healthy: `docker compose ps mysql`
- Permission issues: ensure `.env` is readable: `chmod 644 .env`
- CSS/JS assets not loading: add `ASSET_URL` to `.env` with the same value as `APP_URL`
- Custom Caddyfile not working: ensure you included the `frankenphp` directive in the global block

## Security

- Change all default database passwords for production
- For HTTPS, use a custom Caddyfile with your domain (automatic certificates) or place behind a reverse proxy
- Consider Docker secrets for sensitive environment variables
- The application is production-ready with Octane providing high performance

## Next steps

- Install the RuneLite “GIM Hub” plugin and configure it to use your self‑hosted URL.
