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

### HTTPS setup

There are two approaches to enable HTTPS, depending on your needs:

#### Option 1: Built-in HTTPS with automatic certificates

FrankenPHP automatically generates and renews certificates when you use the `--https` flag. This is the simplest approach for production.

**docker-compose.yml:**

```yaml
services:
  app:
    image: wouterrutgers/gim-hub.com:octane
    command: ["--https", "--domain=yourdomain.com"]
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp" # For HTTP/3 support
    volumes:
      - ./.env:/app/.env
      - caddy_data:/data/caddy
      - caddy_config:/config/caddy
    depends_on:
      mysql:
        condition: service_healthy

  mysql:
    # ... same as before

volumes:
  mysql_data:
  caddy_data: # Persists Let's Encrypt certificates
  caddy_config: # Persists Caddy configuration
```

**Update your `.env`:**

```env
APP_URL=https://yourdomain.com
OCTANE_HTTPS=true
```

> **Important:** The volumes `caddy_data` and `caddy_config` are essential for persisting Let's Encrypt certificates across container restarts. Without them, your app will request new certificates on every restart.

#### Option 2: Custom Caddyfile (for advanced configuration)

If you need custom headers, rate limiting, or other advanced Caddy features, create a custom `Caddyfile`.

**Important:** your Caddyfile must include the `frankenphp` directive in the global block.

**For HTTP only (e.g., behind a reverse proxy):**

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

Mount it in `docker-compose.yml`:

```yaml
volumes:
  - ./.env:/app/.env
  - ./Caddyfile:/Caddyfile:ro
```

**For HTTPS with automatic certificates:**

```caddy
{
    admin off
    email you@example.com

    frankenphp  # Required for Octane!
}

yourdomain.com {
    # Your custom configuration here
    encode gzip zstd

    # Optional: custom headers, rate limiting, etc.
    header X-Custom-Header "value"

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
      - caddy_data:/data/caddy
      - caddy_config:/config/caddy

volumes:
  mysql_data:
  caddy_data: # Persists certificates
  caddy_config:
```

**Update your `.env`:**

```env
APP_URL=https://yourdomain.com
OCTANE_HTTPS=true
```

> **Note:** With a custom Caddyfile for HTTPS, Caddy handles certificate generation and proxies internally to the Octane server on port 8000. The `OCTANE_HTTPS=true` setting ensures Laravel generates HTTPS links correctly.

## Migrating from PHP-FPM to Octane

If you're upgrading from `wouterrutgers/gim-hub.com:latest` (PHP-FPM) to `:octane`:

1. **Update image tag** in `docker-compose.yml` from `:latest` to `:octane`
2. **Update port mapping** in `docker-compose.yml`:
   - For HTTP only: Change from `"80:80"` to `"80:8000"`
   - For HTTPS: Keep `"80:80"` and `"443:443"` (see HTTPS section above)
3. **Update .env volume mount path**: Change from `/var/www/.env` to `/app/.env` (the working directory changed)
4. **Update APP_URL** in `.env`:
   - If you had HTTPS: ensure `APP_URL=https://yourdomain.com`
   - Add `OCTANE_HTTPS=true` to generate HTTPS links
5. **Add certificate persistence** (if using HTTPS):
   - Add volumes for `caddy_data` and `caddy_config` (see HTTPS section above)
6. **Choose HTTPS approach** (if you had HTTPS configured):
   - **Option A:** Use built-in `--https` flag (remove custom Caddyfile)
   - **Option B:** Update your Caddyfile to work with Octane (see example below)
7. **Update Caddyfile mount path** (if keeping custom Caddyfile): Change from `/etc/caddy/Caddyfile` to `/Caddyfile`

### Option A: Use built-in HTTPS

If you had HTTPS configured with the old image, the simplest migration is to use FrankenPHP's built-in HTTPS:

```yaml
services:
  app:
    image: wouterrutgers/gim-hub.com:octane
    command: ["--https", "--domain=yourdomain.com"]
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    volumes:
      - ./.env:/app/.env
      - caddy_data:/data/caddy
      - caddy_config:/config/caddy
    # ... rest of config

volumes:
  mysql_data:
  caddy_data:
  caddy_config:
```

Update `.env`:

```env
APP_URL=https://yourdomain.com
OCTANE_HTTPS=true
```

This approach automatically generates and renews Let's Encrypt certificates.

### Option B: Update your Caddyfile

If you need custom configuration, update your Caddyfile. Here are examples for both HTTP and HTTPS scenarios:

**Migrating HTTP-only Caddyfile (behind reverse proxy):**

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

**After (Octane - HTTP only):**

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

**Migrating HTTPS Caddyfile:**

**Before (PHP-FPM with HTTPS):**

```caddy
{
    admin off
    email you@example.com
}

yourdomain.com {
    root * /var/www/public
    php_fastcgi localhost:9000 {
        root /var/www/public
    }
    file_server
}
```

**After (Octane with HTTPS):**

```caddy
{
    admin off
    email you@example.com

    frankenphp  # Add this!
}

yourdomain.com {
    # Remove root, php_fastcgi, and file_server
    # FrankenPHP handles everything automatically
    # Just add your custom directives
}
```

Don't forget to:

- Add `caddy_data` and `caddy_config` volumes to persist certificates
- Update `.env` with `APP_URL=https://yourdomain.com` and `OCTANE_HTTPS=true`

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

- Install the RuneLite “Group Ironmen Tracker” plugin and configure it to use your self‑hosted URL.
