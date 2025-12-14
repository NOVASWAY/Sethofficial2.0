# Fix Docker Compose for Python 3.12

## Problem
- `python3-distutils` is not available in Python 3.12 (it was removed)
- `docker-compose` v1.29.2 requires distutils
- This causes: `ModuleNotFoundError: No module named 'distutils'`

## Solution: Install Docker Compose V2 Plugin

Run this command:
```bash
sudo apt-get update
sudo apt-get install -y docker-compose-plugin
```

## After Installation

Use `docker compose` (with space) instead of `docker-compose` (with hyphen):

```bash
# Old way (won't work):
docker-compose up -d --build

# New way (works):
docker compose up -d --build
```

## Verify Installation

```bash
docker compose version
```

Should show something like:
```
Docker Compose version v2.x.x
```

## Alternative: Create Alias

If you prefer to keep using `docker-compose` command, add this to your `~/.bashrc`:

```bash
alias docker-compose='docker compose'
```

Then reload:
```bash
source ~/.bashrc
```

## Why This Works

Docker Compose V2 is a plugin for Docker itself, not a separate Python application. It doesn't have Python dependencies and works with all Python versions.

