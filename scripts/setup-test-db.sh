#!/bin/bash

# Test Database Setup Script
# This script sets up a test database for running tests

set -e

echo "=========================================="
echo "Test Database Setup"
echo "=========================================="
echo ""

# Check if PostgreSQL is available
if ! command -v psql &> /dev/null; then
    echo "⚠️  psql not found. Please install PostgreSQL client tools."
    exit 1
fi

# Get database connection info
read -p "Database host (default: localhost): " db_host
db_host=${db_host:-localhost}

read -p "Database port (default: 5432): " db_port
db_port=${db_port:-5432}

read -p "Database superuser (default: postgres): " db_user
db_user=${db_user:-postgres}

read -sp "Database password: " db_password
echo ""

read -p "Test database name (default: clinic_management_test): " test_db_name
test_db_name=${test_db_name:-clinic_management_test}

# Set PGPASSWORD for psql
export PGPASSWORD="$db_password"

echo ""
echo "Creating test database..."

# Create test database
psql -h "$db_host" -p "$db_port" -U "$db_user" -d postgres -c "DROP DATABASE IF EXISTS $test_db_name;" 2>/dev/null || true
psql -h "$db_host" -p "$db_port" -U "$db_user" -d postgres -c "CREATE DATABASE $test_db_name;" || {
    echo "❌ Failed to create test database"
    exit 1
}

echo "✅ Test database created: $test_db_name"

# Run migrations
echo ""
echo "Running migrations on test database..."

TEST_DATABASE_URL="postgresql://$db_user:$db_password@$db_host:$db_port/$test_db_name"

cd backend
export DATABASE_URL="$TEST_DATABASE_URL"

if command -v sqlx &> /dev/null; then
    sqlx migrate run || {
        echo "⚠️  sqlx migrate failed. Trying alternative method..."
        # Alternative: run SQL files directly
        for migration in migrations/*.sql; do
            if [ -f "$migration" ]; then
                echo "Running $migration..."
                psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$test_db_name" -f "$migration" || echo "Warning: $migration may have errors"
            fi
        done
    }
else
    echo "⚠️  sqlx not found. Running migrations manually..."
    for migration in migrations/*.sql; do
        if [ -f "$migration" ]; then
            echo "Running $migration..."
            psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$test_db_name" -f "$migration" || echo "Warning: $migration may have errors"
        done
    fi
fi

cd ..

# Update .env file with test database URL
ENV_FILE="backend/.env"
if [ -f "$ENV_FILE" ]; then
    sed -i "s|^TEST_DATABASE_URL=.*|TEST_DATABASE_URL=$TEST_DATABASE_URL|" "$ENV_FILE" || echo "TEST_DATABASE_URL=$TEST_DATABASE_URL" >> "$ENV_FILE"
    echo ""
    echo "✅ TEST_DATABASE_URL added to $ENV_FILE"
else
    echo ""
    echo "⚠️  $ENV_FILE not found. Please add manually:"
    echo "TEST_DATABASE_URL=$TEST_DATABASE_URL"
fi

echo ""
echo "✅ Test database setup complete!"
echo ""
echo "To run tests:"
echo "  export TEST_DATABASE_URL=\"$TEST_DATABASE_URL\""
echo "  cd backend && cargo test"

