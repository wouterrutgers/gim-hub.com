# GIM Hub self hosting guide

Run your own GIM Hub instance with the published Docker image. It includes PHP, the frontend assets, Laravel Octane with FrankenPHP, Laravel Horizon, and the scheduler.

## Prerequisites

- Docker with the `docker compose` command available.
- A host reachable by your teammates. The image supports `linux/amd64` and `linux/arm64`.

## Quick start

Create two files: `docker-compose.yml` and `.env`. You do not need PHP, Composer, or Node.js on the host.

1. Create a working directory and enter it

```bash
mkdir gim-hub && cd gim-hub
```

2. Create `docker-compose.yml`

```yaml
services:
  app:
    image: wouterrutgers/gim-hub.com
    restart: unless-stopped
    ports:
      - "80:8000"
    volumes:
      - ./.env:/app/.env
      - caddy_data:/data/caddy
      - caddy_config:/config/caddy
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy

  mysql:
    image: mysql:8.4
    restart: unless-stopped
    environment:
      MYSQL_DATABASE: gim
      MYSQL_USER: gim
      MYSQL_PASSWORD: ${DB_PASSWORD}
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD-SHELL", 'mysqladmin ping -h 127.0.0.1 -uroot -p"$$MYSQL_ROOT_PASSWORD" || exit 1']
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 10s

  redis:
    image: redis:8-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 10s

volumes:
  mysql_data:
  redis_data:
  caddy_data:
  caddy_config:
```

3. Create `.env` and replace both password placeholders with different strong passwords. Leave `APP_KEY` empty for the first start.

```env
APP_NAME="GIM Hub"
APP_ENV=production
APP_KEY=
APP_DEBUG=false
ENABLE_HORIZON_ADMIN=false
APP_URL=http://localhost
LOG_CHANNEL=stderr

DB_CONNECTION=mysql
DB_HOST=mysql
DB_PORT=3306
DB_DATABASE=gim
DB_USERNAME=gim
DB_PASSWORD='replace-with-a-strong-database-password'
MYSQL_ROOT_PASSWORD='replace-with-a-different-strong-root-password'

SESSION_DRIVER=database
QUEUE_CONNECTION=redis
CACHE_STORE=file

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=null
```

4. Start the stack

```bash
docker compose config --quiet
docker compose pull app
docker compose up -d
docker compose ps
```

The first start generates an application key in your mounted `.env`, caches configuration, and runs database migrations. Keep this file writable and preserve the generated key when updating or moving the installation.

Open `http://localhost` on the Docker host, or use its hostname or IP address from another computer. Set `APP_URL` to the address your teammates will use. If port 80 is already in use, change the mapping to `"8080:8000"` and include `:8080` in `APP_URL`.

For access over the internet, configure HTTPS below or use an existing reverse proxy.

## Connect RuneLite

1. Create a group on your own GIM Hub instance and save its group name and token.
2. Install **GIM Hub** from the RuneLite Plugin Hub.
3. Enter that group name and token in the plugin's **Group config** section.
4. Under **Self hosted config**, set **Server base URL override** to your instance's address, for example `https://gim.example.com`.
5. Have every teammate use the same server address and group credentials. Member names on the website must match their in game display names.

## Background services

Supervisor automatically starts and restarts these processes inside the app container:

- **Octane:** Serves the website and API through FrankenPHP on port 8000.
- **Horizon:** Runs the Redis queue workers. Keep `QUEUE_CONNECTION=redis` and the Redis service enabled.
- **Scheduler:** Runs skill history aggregation and retention, weekly activity summaries, plugin version refreshes, and Horizon metric snapshots.

You do not need a separate queue container or host cron job. To inspect the queue worker and scheduled commands:

```bash
docker compose exec app php artisan horizon:status
docker compose exec app php artisan schedule:list
```

## Configuration notes

- The database name and username are `gim`. Compose reads both database passwords from `.env`.
- MySQL initializes its user and passwords only when `mysql_data` is empty. Editing `.env` does not change passwords in an existing database.
- Changes to `.env` require `docker compose restart app`, because Laravel caches configuration and the application processes stay running.
- Keep `APP_DEBUG=false` and `ENABLE_HORIZON_ADMIN=false`. Enabling the Horizon dashboard does not add login protection; protect `/horizon` separately before enabling it.
- HTTP works without a custom Caddyfile. If an existing reverse proxy handles HTTPS, forward requests to the app's HTTP port and set `APP_URL=https://yourdomain.com` and `OCTANE_HTTPS=true`.

## Advanced configuration

### HTTPS setup

To let FrankenPHP handle HTTPS directly, point your domain's DNS records at the server and make ports 80 and 443 reachable. Caddy obtains and renews certificates automatically. See [Caddy's automatic HTTPS documentation](https://caddyserver.com/docs/automatic-https) for the requirements.

Create `Caddyfile` alongside `docker-compose.yml`, replacing `yourdomain.com` and the email address:

```caddy
{
    email you@example.com

    frankenphp {
        worker {
            file /app/public/frankenphp-worker.php
            num 2
        }
    }
}

http://:8000, yourdomain.com {
    log {
        level ERROR
    }

    route {
        root * /app/public
        encode zstd br gzip

        php_server {
            index frankenphp-worker.php
            try_files {path} frankenphp-worker.php
            resolve_root_symlink
        }
    }
}
```

Keep the HTTP listener on port 8000 for the image's `/up` health check. The admin endpoint on localhost port 2019 is used by Octane to inspect, stop, and reload workers; do not publish it on the host.

Replace the app service's `ports` and `volumes` sections with the following. Keep its image, restart policy, and database dependencies:

```yaml
services:
  app:
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    volumes:
      - ./.env:/app/.env
      - ./Caddyfile:/Caddyfile:ro
      - caddy_data:/data/caddy
      - caddy_config:/config/caddy
```

Update `.env`:

```env
APP_URL=https://yourdomain.com
OCTANE_HTTPS=true
SESSION_SECURE_COOKIE=true
```

Recreate the app container to apply the new ports and file mount:

```bash
docker compose config --quiet
docker compose up -d --force-recreate app
```

Keep `caddy_data` to preserve certificates and private keys. `caddy_config` stores Caddy's saved configuration. After editing the mounted `Caddyfile`, recreate the app container again so it reads the current file.

## Updating and backups

Back up your MySQL database and `.env` before updating. Migrations run automatically when the new app container starts. Keep the generated `APP_KEY` and all existing named volumes.

```bash
docker compose pull app
docker compose up -d app
docker compose ps
```

MySQL data lives in `mysql_data`, Redis data in `redis_data`, and HTTPS certificate data in `caddy_data`. Do not use `docker compose down -v` unless you intend to delete these volumes and their data.

## Troubleshooting

- **Container will not start:** Check `docker compose logs --tail=100 app mysql redis`.
- **Database connection fails:** Check `DB_HOST=mysql`, `REDIS_HOST=redis`, the database credentials, and `docker compose ps`. Existing MySQL volumes keep their original credentials.
- **Application key cannot be generated:** Ensure `.env` exists as a file and is writable by the container. Do not mount it read only.
- **Changed settings are ignored:** Run `docker compose restart app`. If you changed ports or mounts, use `docker compose up -d --force-recreate app` instead.
- **CSS or JavaScript does not load:** Check `APP_URL` and, when using HTTPS, `OCTANE_HTTPS=true`. If you set `ASSET_URL`, it must point to the correct public address. Restart the app after changes.
- **Plugin cannot connect:** Check the server URL override on every teammate's client and confirm their computer can reach that address.
