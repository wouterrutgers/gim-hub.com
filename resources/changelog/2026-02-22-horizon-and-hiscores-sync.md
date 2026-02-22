# Periodic hiscores sync

- Added a scheduled sync (runs every 2 hours) to update member stats that are out of date.
- If you're self-hosting: this uses Laravel Horizon, so you'll need a queue worker process running.
  - The [self-hosting docs](https://github.com/wouterrutgers/gim-hub.com/blob/master/self-host.md) have been updated with the queue worker requirement and instructions for setting up Redis.
