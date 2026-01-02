#!/bin/bash
BASE_DIR="$(cd "$(dirname "$0")" && pwd)"

docker run -d \
  --name searxng \
  -p 8888:8080 \
  -v "$BASE_DIR/config:/etc/searxng" \
  -v "$BASE_DIR/data:/var/cache/searxng" \
  searxng/searxng@sha256:8d98d5c1b678714c3b20dacfab5ea5e3b67f79e50df6d5dbc92ed4f0a964ccbd
