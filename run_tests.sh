#!/bin/bash

# Comprehensive Test Runner for Clinic Management System
# This script runs all tests with proper configuration and reporting

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TEST_DATABASE_URL="postgresql://postgres:password@localhost:5432/clinic_management_test"
DATABASE_URL="postgresql://postgres:password@localhost:5432/clinic_management"
JWT_SECRET="test-secret-key-for-testing-only"
ENABLE_INTEGRATION_TESTS="true"
ENABLE_E2E_TESTS="true"
ENABLE_PERFORMANCE_TESTS="false"
TEST_LOG_LEVEL="info"
TEST_DATA_CLEANUP="true"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if Rust is installed
    if ! command -v cargo &> /dev/null; then
        print_error "Cargo is not installed. Please install Rust first."
        exit 1
    fi
    
    # Check if PostgreSQL is running
    if ! pg_isready -h localhost -p 5432 &> /dev/null; then
        print_error "PostgreSQL is not running. Please start PostgreSQL first."
        exit 1
    fi
    
    # Check if test database exists
    if ! psql -h localhost -U postgres -d clinic_management_test -c "SELECT 1;" &> /dev/null; then
        print_warning "Test database does not exist. Creating..."
        createdb -h localhost -U postgres clinic_management_test
    fi
    
    print_success "Prerequisites check completed"
}

# Function to setup test environment
setup_test_environment() {
    print_status "Setting up test environment..."
    
    # Set environment variables
    export DATABASE_URL="$DATABASE_URL"
    export TEST_DATABASE_URL="$TEST_DATABASE_URL"
    export JWT_SECRET="$JWT_SECRET"
    export ENABLE_INTEGRATION_TESTS="$ENABLE_INTEGRATION_TESTS"
    export ENABLE_E2E_TESTS="$ENABLE_E2E_TESTS"
    export ENABLE_PERFORMANCE_TESTS="$ENABLE_PERFORMANCE_TESTS"
    export TEST_LOG_LEVEL="$TEST_LOG_LEVEL"
    export TEST_DATA_CLEANUP="$TEST_DATA_CLEANUP"
    
    # Run database migrations
    print_status "Running database migrations..."
    cd backend
    sqlx migrate run --database-url "$TEST_DATABASE_URL"
    cd ..
    
    print_success "Test environment setup completed"
}

# Function to run unit tests
run_unit_tests() {
    print_status "Running unit tests..."
    
    cd backend
    cargo test --test unit_tests -- --nocapture
    cd ..
    
    print_success "Unit tests completed"
}

# Function to run integration tests
run_integration_tests() {
    if [ "$ENABLE_INTEGRATION_TESTS" = "true" ]; then
        print_status "Running integration tests..."
        
        cd backend
        cargo test --test integration_tests -- --nocapture
        cd ..
        
        print_success "Integration tests completed"
    else
        print_warning "Integration tests are disabled"
    fi
}

# Function to run E2E tests
run_e2e_tests() {
    if [ "$ENABLE_E2E_TESTS" = "true" ]; then
        print_status "Running E2E tests..."
        
        cd backend
        cargo test --test e2e_tests -- --nocapture
        cd ..
        
        print_success "E2E tests completed"
    else
        print_warning "E2E tests are disabled"
    fi
}

# Function to run performance tests
run_performance_tests() {
    if [ "$ENABLE_PERFORMANCE_TESTS" = "true" ]; then
        print_status "Running performance tests..."
        
        cd backend
        cargo test performance_tests -- --nocapture
        cd ..
        
        print_success "Performance tests completed"
    else
        print_warning "Performance tests are disabled"
    fi
}

# Function to run security tests
run_security_tests() {
    print_status "Running security tests..."
    
    cd backend
    cargo test security_tests -- --nocapture
    cd ..
    
    print_success "Security tests completed"
}

# Function to run all tests
run_all_tests() {
    print_status "Running all tests..."
    
    cd backend
    cargo test --all-features -- --nocapture
    cd ..
    
    print_success "All tests completed"
}

# Function to generate test report
generate_test_report() {
    print_status "Generating test report..."
    
    # Create reports directory
    mkdir -p reports
    
    # Generate test coverage report (if available)
    if command -v cargo-tarpaulin &> /dev/null; then
        print_status "Generating coverage report..."
        cd backend
        cargo tarpaulin --out Html --output-dir ../reports
        cd ..
        print_success "Coverage report generated in reports/"
    else
        print_warning "cargo-tarpaulin not installed. Skipping coverage report."
    fi
    
    # Generate test summary
    echo "Test Summary" > reports/test_summary.txt
    echo "============" >> reports/test_summary.txt
    echo "Date: $(date)" >> reports/test_summary.txt
    echo "Environment: $TEST_DATABASE_URL" >> reports/test_summary.txt
    echo "Integration Tests: $ENABLE_INTEGRATION_TESTS" >> reports/test_summary.txt
    echo "E2E Tests: $ENABLE_E2E_TESTS" >> reports/test_summary.txt
    echo "Performance Tests: $ENABLE_PERFORMANCE_TESTS" >> reports/test_summary.txt
    
    print_success "Test report generated in reports/"
}

# Function to cleanup test environment
cleanup_test_environment() {
    if [ "$TEST_DATA_CLEANUP" = "true" ]; then
        print_status "Cleaning up test environment..."
        
        # Clean test database
        psql -h localhost -U postgres -d clinic_management_test -c "
            DELETE FROM audit_logs;
            DELETE FROM notifications;
            DELETE FROM user_settings;
            DELETE FROM system_settings;
            DELETE FROM invoices;
            DELETE FROM prescriptions;
            DELETE FROM appointments;
            DELETE FROM consultations;
            DELETE FROM medicines;
            DELETE FROM patients;
            DELETE FROM sessions;
            DELETE FROM users;
        " &> /dev/null || true
        
        print_success "Test environment cleanup completed"
    else
        print_warning "Test data cleanup is disabled"
    fi
}

# Function to show help
show_help() {
    echo "Clinic Management System Test Runner"
    echo "===================================="
    echo ""
    echo "Usage: $0 [OPTIONS] [TEST_TYPE]"
    echo ""
    echo "OPTIONS:"
    echo "  -h, --help              Show this help message"
    echo "  -v, --verbose           Enable verbose output"
    echo "  --no-cleanup            Disable test data cleanup"
    echo "  --performance           Enable performance tests"
    echo "  --no-integration        Disable integration tests"
    echo "  --no-e2e               Disable E2E tests"
    echo "  --report                Generate test report"
    echo ""
    echo "TEST_TYPE:"
    echo "  unit                    Run unit tests only"
    echo "  integration             Run integration tests only"
    echo "  e2e                     Run E2E tests only"
    echo "  performance             Run performance tests only"
    echo "  security                Run security tests only"
    echo "  all                     Run all tests (default)"
    echo ""
    echo "Examples:"
    echo "  $0                      # Run all tests"
    echo "  $0 unit                 # Run unit tests only"
    echo "  $0 --performance        # Run all tests including performance"
    echo "  $0 --report             # Run all tests and generate report"
}

# Main function
main() {
    local test_type="all"
    local verbose=false
    local generate_report=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -v|--verbose)
                verbose=true
                shift
                ;;
            --no-cleanup)
                TEST_DATA_CLEANUP="false"
                shift
                ;;
            --performance)
                ENABLE_PERFORMANCE_TESTS="true"
                shift
                ;;
            --no-integration)
                ENABLE_INTEGRATION_TESTS="false"
                shift
                ;;
            --no-e2e)
                ENABLE_E2E_TESTS="false"
                shift
                ;;
            --report)
                generate_report=true
                shift
                ;;
            unit|integration|e2e|performance|security|all)
                test_type="$1"
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Set verbose mode
    if [ "$verbose" = true ]; then
        set -x
    fi
    
    print_status "Starting test execution..."
    print_status "Test type: $test_type"
    print_status "Database: $TEST_DATABASE_URL"
    
    # Check prerequisites
    check_prerequisites
    
    # Setup test environment
    setup_test_environment
    
    # Run tests based on type
    case $test_type in
        unit)
            run_unit_tests
            ;;
        integration)
            run_integration_tests
            ;;
        e2e)
            run_e2e_tests
            ;;
        performance)
            run_performance_tests
            ;;
        security)
            run_security_tests
            ;;
        all)
            run_unit_tests
            run_integration_tests
            run_e2e_tests
            run_security_tests
            run_performance_tests
            ;;
    esac
    
    # Generate test report if requested
    if [ "$generate_report" = true ]; then
        generate_test_report
    fi
    
    # Cleanup test environment
    cleanup_test_environment
    
    print_success "Test execution completed successfully!"
}

# Run main function with all arguments
main "$@"
