#!/bin/bash

cache=$(curl -s https://archive.openrs2.org/caches.json | jq -r '
[ .[] | select(.game == "oldschool" and .environment == "live" and .language == "en" and (.sources | contains(["Jagex"])) and .size != null) ] |
sort_by(.id) | last
')

CACHE_ID=$(echo $cache | jq -r '.id')

echo "CACHE_ID $CACHE_ID"

curl -o cache/xteas.json https://archive.openrs2.org/caches/runescape/$CACHE_ID/keys.json
curl -o cache/disk.zip https://archive.openrs2.org/caches/runescape/$CACHE_ID/disk.zip

unzip cache/disk.zip -d cache
