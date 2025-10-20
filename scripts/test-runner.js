#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function runCommand(command, description) {
  log(`\n${colors.cyan}${description}${colors.reset}`);
  log(`${colors.yellow}Running: ${command}${colors.reset}`);
  
  try {
    const output = execSync(command, { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    log(`${colors.green}✅ ${description} completed successfully${colors.reset}`);
    return true;
  } catch (error) {
    log(`${colors.red}❌ ${description} failed${colors.reset}`);
    log(`${colors.red}Error: ${error.message}${colors.reset}`);
    return false;
  }
}

function checkFileExists(filePath) {
  return fs.existsSync(path.join(process.cwd(), filePath));
}

function main() {
  log(`${colors.bright}${colors.blue}🧪 Enhanced Dashboard Test Runner${colors.reset}`);
  log(`${colors.blue}=====================================${colors.reset}`);

  // Check if we're in the right directory
  if (!checkFileExists('package.json')) {
    log(`${colors.red}❌ Error: package.json not found. Please run this script from the project root.${colors.reset}`);
    process.exit(1);
  }

  // Check if Jest is installed
  if (!checkFileExists('node_modules/.bin/jest')) {
    log(`${colors.yellow}⚠️  Jest not found. Installing dependencies...${colors.reset}`);
    if (!runCommand('npm install', 'Installing dependencies')) {
      log(`${colors.red}❌ Failed to install dependencies${colors.reset}`);
      process.exit(1);
    }
  }

  // Check if test files exist
  const testFiles = [
    '__tests__/dashboard.test.tsx',
    'backend/tests/dashboard_tests.rs'
  ];

  const missingTests = testFiles.filter(file => !checkFileExists(file));
  if (missingTests.length > 0) {
    log(`${colors.yellow}⚠️  Missing test files:${colors.reset}`);
    missingTests.forEach(file => log(`   - ${file}`));
  }

  // Run frontend tests
  log(`\n${colors.bright}${colors.magenta}Frontend Tests${colors.reset}`);
  log(`${colors.magenta}==============${colors.reset}`);
  
  if (checkFileExists('__tests__/dashboard.test.tsx')) {
    runCommand('npm test -- --testPathPattern=dashboard.test.tsx --verbose', 'Running frontend dashboard tests');
  } else {
    log(`${colors.yellow}⚠️  Frontend test file not found, skipping...${colors.reset}`);
  }

  // Run backend tests
  log(`\n${colors.bright}${colors.magenta}Backend Tests${colors.reset}`);
  log(`${colors.magenta}=============${colors.reset}`);
  
  if (checkFileExists('backend/tests/dashboard_tests.rs')) {
    runCommand('cd backend && cargo test dashboard_tests --verbose', 'Running backend dashboard tests');
  } else {
    log(`${colors.yellow}⚠️  Backend test file not found, skipping...${colors.reset}`);
  }

  // Run integration tests
  log(`\n${colors.bright}${colors.magenta}Integration Tests${colors.reset}`);
  log(`${colors.magenta}=================${colors.reset}`);
  
  if (checkFileExists('__tests__/integration.test.tsx')) {
    runCommand('npm test -- --testPathPattern=integration.test.tsx --verbose', 'Running integration tests');
  } else {
    log(`${colors.yellow}⚠️  Integration test file not found, skipping...${colors.reset}`);
  }

  // Run all tests
  log(`\n${colors.bright}${colors.magenta}All Tests${colors.reset}`);
  log(`${colors.magenta}=========${colors.reset}`);
  
  runCommand('npm test -- --coverage --watchAll=false', 'Running all frontend tests with coverage');
  
  if (checkFileExists('backend/Cargo.toml')) {
    runCommand('cd backend && cargo test --verbose', 'Running all backend tests');
  }

  // Generate test report
  log(`\n${colors.bright}${colors.cyan}Test Report Generation${colors.reset}`);
  log(`${colors.cyan}======================${colors.reset}`);
  
  if (checkFileExists('coverage/lcov-report/index.html')) {
    log(`${colors.green}✅ Coverage report generated at coverage/lcov-report/index.html${colors.reset}`);
  }

  // Performance tests
  log(`\n${colors.bright}${colors.magenta}Performance Tests${colors.reset}`);
  log(`${colors.magenta}=================${colors.reset}`);
  
  if (checkFileExists('__tests__/performance.test.tsx')) {
    runCommand('npm test -- --testPathPattern=performance.test.tsx --verbose', 'Running performance tests');
  } else {
    log(`${colors.yellow}⚠️  Performance test file not found, skipping...${colors.reset}`);
  }

  // Accessibility tests
  log(`\n${colors.bright}${colors.magenta}Accessibility Tests${colors.reset}`);
  log(`${colors.magenta}====================${colors.reset}`);
  
  if (checkFileExists('__tests__/accessibility.test.tsx')) {
    runCommand('npm test -- --testPathPattern=accessibility.test.tsx --verbose', 'Running accessibility tests');
  } else {
    log(`${colors.yellow}⚠️  Accessibility test file not found, skipping...${colors.reset}`);
  }

  log(`\n${colors.bright}${colors.green}🎉 Test run completed!${colors.reset}`);
  log(`${colors.green}Check the output above for any failures.${colors.reset}`);
  
  // Summary
  log(`\n${colors.bright}${colors.blue}Test Summary${colors.reset}`);
  log(`${colors.blue}============${colors.reset}`);
  log(`Frontend Tests: ${checkFileExists('__tests__/dashboard.test.tsx') ? '✅ Available' : '❌ Missing'}`);
  log(`Backend Tests: ${checkFileExists('backend/tests/dashboard_tests.rs') ? '✅ Available' : '❌ Missing'}`);
  log(`Integration Tests: ${checkFileExists('__tests__/integration.test.tsx') ? '✅ Available' : '❌ Missing'}`);
  log(`Performance Tests: ${checkFileExists('__tests__/performance.test.tsx') ? '✅ Available' : '❌ Missing'}`);
  log(`Accessibility Tests: ${checkFileExists('__tests__/accessibility.test.tsx') ? '✅ Available' : '❌ Missing'}`);
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  log(`${colors.bright}${colors.blue}Enhanced Dashboard Test Runner${colors.reset}`);
  log(`${colors.blue}=====================================${colors.reset}`);
  log(`Usage: node scripts/test-runner.js [options]`);
  log(``);
  log(`Options:`);
  log(`  --help, -h     Show this help message`);
  log(`  --frontend     Run only frontend tests`);
  log(`  --backend      Run only backend tests`);
  log(`  --integration  Run only integration tests`);
  log(`  --performance  Run only performance tests`);
  log(`  --coverage     Generate coverage report`);
  log(``);
  log(`Examples:`);
  log(`  node scripts/test-runner.js --frontend`);
  log(`  node scripts/test-runner.js --backend`);
  log(`  node scripts/test-runner.js --coverage`);
  process.exit(0);
}

if (args.includes('--frontend')) {
  log(`${colors.bright}${colors.blue}Running Frontend Tests Only${colors.reset}`);
  if (checkFileExists('__tests__/dashboard.test.tsx')) {
    runCommand('npm test -- --testPathPattern=dashboard.test.tsx --verbose', 'Running frontend dashboard tests');
  }
  process.exit(0);
}

if (args.includes('--backend')) {
  log(`${colors.bright}${colors.blue}Running Backend Tests Only${colors.reset}`);
  if (checkFileExists('backend/tests/dashboard_tests.rs')) {
    runCommand('cd backend && cargo test dashboard_tests --verbose', 'Running backend dashboard tests');
  }
  process.exit(0);
}

if (args.includes('--integration')) {
  log(`${colors.bright}${colors.blue}Running Integration Tests Only${colors.reset}`);
  if (checkFileExists('__tests__/integration.test.tsx')) {
    runCommand('npm test -- --testPathPattern=integration.test.tsx --verbose', 'Running integration tests');
  }
  process.exit(0);
}

if (args.includes('--performance')) {
  log(`${colors.bright}${colors.blue}Running Performance Tests Only${colors.reset}`);
  if (checkFileExists('__tests__/performance.test.tsx')) {
    runCommand('npm test -- --testPathPattern=performance.test.tsx --verbose', 'Running performance tests');
  }
  process.exit(0);
}

if (args.includes('--coverage')) {
  log(`${colors.bright}${colors.blue}Generating Coverage Report${colors.reset}`);
  runCommand('npm test -- --coverage --watchAll=false', 'Generating coverage report');
  process.exit(0);
}

// Run all tests if no specific option is provided
main();
