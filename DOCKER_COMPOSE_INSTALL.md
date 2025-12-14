# Install Docker Compose V2 - Solutions

## Problem
- `docker-compose` v1.29.2 doesn't work with Python 3.12
- `docker-compose-plugin` not available in Ubuntu's default repositories
- `python3-distutils` not available in Python 3.12

## Solution Options

### Option 1: Add Docker's Official Repository (Recommended)

Run the installation script:
```bash
./install-docker-compose-v2.sh
```

Or manually:
```bash
# Install prerequisites
sudo apt-get update
sudo apt-get install -y ca-certificates curl

# Add Docker's GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install plugin
sudo apt-get update
sudo apt-get install -y docker-compose-plugin
```

### Option 2: Download Binary Directly (Quick Fix)

Run the binary installation script:
```bash
./install-docker-compose-binary.sh
```

This downloads the latest Docker Compose V2 binary directly from GitHub.

### Option 3: Use Python Virtual Environment (Workaround)

If you want to keep using docker-compose v1:
```bash
# Create venv with Python 3.11 or earlier
python3.11 -m venv ~/docker-compose-env
source ~/docker-compose-env/bin/activate
pip install docker-compose==1.29.2

# Use it
~/docker-compose-env/bin/docker-compose up -d --build
```

## After Installation

Use `docker compose` (with space) instead of `docker-compose`:

```bash
# Start the system
docker compose up -d --build

# Check status
docker compose ps

# View logs
docker compose logs -f
```

## Verify Installation

```bash
docker compose version
```

Should show:
```
Docker Compose version v2.x.x
```

## Recommendation

**Use Option 1** (Official Repository) - It's the most reliable and keeps Docker Compose updated automatically.

