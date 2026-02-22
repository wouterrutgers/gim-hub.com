# Periodic hiscores sync

- Added scheduled background syncing for stale member hiscores.
- Note for self-hosted setups: this uses Laravel Horizon and needs a queue worker process to be running.
  - The [self-hosting docs](https://github.com/wouterrutgers/gim-hub.com/blob/master/self-host.md) have been updated to cover the queue worker requirement and how to set up Redis.
