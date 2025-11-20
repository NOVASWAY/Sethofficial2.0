# Quick Start Guide

**Date**: Generated automatically  
**Status**: Complete quick start instructions

---

## 🚀 Get Started in 5 Minutes

### Prerequisites
- Docker and Docker Compose installed
- Git installed
- Basic terminal knowledge

---

## Step 1: Clone and Navigate

```bash
cd /home/njau/projects/Sethofficial2.0
```

---

## Step 2: Run Automated Setup

```bash
# Make scripts executable (if needed)
chmod +x scripts/*.sh

# Run complete setup
./scripts/setup-all.sh
```

This will guide you through:
- Environment file creation
- Secret generation
- Service configuration (email, SMS, M-Pesa - optional)
- Test database setup (optional)
- SSL certificate generation (optional)

---

## Step 3: Start Services

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

---

## Step 4: Verify Installation

```bash
# Check health
curl http://localhost:8080/health

# Should return: {"status":"ok"}
```

---

## Step 5: Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080
- **API Documentation**: http://localhost:8080/api/docs (if available)
- **Health Check**: http://localhost:8080/health

---

## 🎯 Common Next Steps

### Configure Email Service
```bash
./scripts/configure-email.sh
```

### Configure SMS Service (Optional)
```bash
./scripts/configure-sms.sh
```

### Configure M-Pesa (Optional)
```bash
./scripts/configure-mpesa.sh
```

### Set Up Test Database
```bash
./scripts/setup-test-db.sh
```

### Run Tests
```bash
./scripts/run-tests.sh
```

---

## 📚 Documentation

- **[Configuration Guide](CONFIGURATION_GUIDE.md)** - Detailed configuration instructions
- **[Testing Guide](TESTING_GUIDE.md)** - How to test the system
- **[Environment Variables](ENVIRONMENT_VARIABLES.md)** - Complete variable reference
- **[Deployment Checklist](DEPLOYMENT_CHECKLIST.md)** - Pre-deployment verification

---

## 🔧 Troubleshooting

### Services Not Starting
```bash
# Check logs
docker-compose logs

# Restart services
docker-compose restart

# Rebuild if needed
docker-compose up -d --build
```

### Database Connection Issues
```bash
# Check database is running
docker-compose ps postgres

# Check connection string in .env
cat backend/.env | grep DATABASE_URL
```

### Port Already in Use
```bash
# Check what's using the port
sudo lsof -i :8080
sudo lsof -i :3000

# Change ports in docker-compose.yml if needed
```

---

## 🎉 You're Ready!

The system is now running. Next steps:

1. **Configure external services** (email, SMS, M-Pesa) if needed
2. **Create admin user** (if not already created)
3. **Review security settings** in `backend/.env`
4. **Set up monitoring** (optional): `./scripts/setup-monitoring.sh`
5. **Configure backups**: `./scripts/configure-backup.sh`

---

## 📞 Need Help?

- Check the [Configuration Guide](CONFIGURATION_GUIDE.md) for detailed instructions
- Review [Environment Variables](ENVIRONMENT_VARIABLES.md) for configuration options
- See [Testing Guide](TESTING_GUIDE.md) for testing procedures
- Check [FINAL_STATUS.md](FINAL_STATUS.md) for system status

---

**Last Updated**: Generated automatically

