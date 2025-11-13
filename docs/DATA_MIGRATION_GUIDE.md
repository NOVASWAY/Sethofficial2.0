# Data Migration & Seed Guide

**Date**: January 2025  
**Status**: Complete

---

## Overview

This guide describes the database migration system, seed scripts, and data validation procedures for the Clinic Management System.

---

## Migration System

### Running Migrations

```bash
# Run all pending migrations
cd backend
sqlx migrate run

# Check migration status
sqlx migrate info

# Revert last migration (if rollback script exists)
sqlx migrate revert
```

### Migration Files

Migrations are located in `backend/migrations/`:
- `001_initial_schema.sql` - Initial database schema
- `002_*.sql` - Feature-specific migrations
- `010_password_reset_system.sql` - Password reset tables
- etc.

---

## Seed Data

### Production Seed

```bash
# Seed production data
psql -U clinic_user -d clinic_management -f backend/scripts/seed_production.sql
```

**Important**: 
- Change default admin password immediately
- Review all seed data before production
- Remove test data before production deployment

### Development Seed

```bash
# Seed development/test data
psql -U clinic_user -d clinic_management -f backend/scripts/seed_development.sql
```

---

## Migration Validation

### Validate Migrations

```bash
# Run validation script
./backend/scripts/validate_migrations.sh
```

This checks:
- ✅ Database connectivity
- ✅ Core tables exist
- ✅ Required columns present
- ✅ Indexes created
- ✅ Foreign key constraints

---

## Migration Rollback

### Rollback Procedure

1. **Identify Migration**: Check which migration to rollback
2. **Backup Database**: Create backup before rollback
3. **Run Rollback**: Execute rollback script
4. **Validate**: Verify database state

```bash
# Interactive rollback
./backend/scripts/migration_rollback.sh

# Manual rollback (if rollback SQL exists)
psql -U clinic_user -d clinic_management -f backend/migrations/rollback/XXX_rollback.sql
```

---

## Data Validation

### Validate Data Integrity

```bash
# Run data validation
./scripts/validate-data.sh
```

Checks:
- ✅ Referential integrity
- ✅ Data consistency
- ✅ No orphaned records
- ✅ No duplicate records

---

## Best Practices

1. **Always Backup**: Backup database before migrations
2. **Test Migrations**: Test on staging before production
3. **Validate Data**: Run validation after migrations
4. **Document Changes**: Document migration changes
5. **Version Control**: Keep migrations in version control

---

## Troubleshooting

### Migration Fails

1. Check database connectivity
2. Review migration SQL syntax
3. Check for conflicts with existing data
4. Review error messages

### Data Validation Fails

1. Review validation errors
2. Check for data inconsistencies
3. Fix data issues
4. Re-run validation

---

**Last Updated**: January 2025

