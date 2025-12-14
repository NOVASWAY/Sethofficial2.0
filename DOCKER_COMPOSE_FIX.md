# Docker Compose Fix

## Issue
`docker-compose` v1.29.2 is incompatible with Python 3.12 (missing `distutils` module).

## Solutions

### Option 1: Install python3-distutils (Quick Fix)
```bash
sudo apt-get install -y python3-distutils
```

Then use `docker-compose` as normal:
```bash
docker-compose up -d --build
```

### Option 2: Install Docker Compose V2 Plugin (Recommended)
```bash
sudo apt-get install -y docker-compose-plugin
```

Then use `docker compose` (with space, not hyphen):
```bash
docker compose up -d --build
```

### Option 3: Use the Wrapper Script
```bash
./docker-compose-fix.sh up -d --build
```

## Verify Installation

After installing either solution:
```bash
# For Option 1:
docker-compose --version

# For Option 2:
docker compose version
```

## Why This Happened

Python 3.12 removed the `distutils` module, but `docker-compose` v1.29.2 still depends on it. Docker Compose V2 (the plugin) doesn't have this dependency and is the modern way to use Docker Compose.

