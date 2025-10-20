#!/bin/bash

# Test Setup Script for Seth Medical Clinic Management System
# This script ensures all testing dependencies are properly installed and configured

echo "🧪 Setting up test environment for Seth Medical Clinic Management System..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
else
    echo "✅ Dependencies already installed"
fi

# Install test-specific dependencies
echo "🧪 Installing test dependencies..."
npm install --save-dev @testing-library/jest-dom @testing-library/react @testing-library/user-event @types/jest jest jest-environment-jsdom ts-jest

# Create test directories if they don't exist
mkdir -p __tests__/components/ui
mkdir -p __tests__/components
mkdir -p __tests__/lib
mkdir -p __tests__/contexts
mkdir -p __tests__/hooks

echo "✅ Test directories created"

# Run type checking
echo "🔍 Running TypeScript type checking..."
npm run type-check

if [ $? -eq 0 ]; then
    echo "✅ TypeScript type checking passed"
else
    echo "❌ TypeScript type checking failed"
    exit 1
fi

# Run linting
echo "🔍 Running ESLint..."
npm run lint

if [ $? -eq 0 ]; then
    echo "✅ ESLint passed"
else
    echo "⚠️  ESLint found issues (non-blocking)"
fi

# Run tests
echo "🧪 Running tests..."
npm test -- --passWithNoTests

if [ $? -eq 0 ]; then
    echo "✅ All tests passed"
else
    echo "❌ Some tests failed"
    exit 1
fi

echo "🎉 Test setup completed successfully!"
echo ""
echo "📋 Available test commands:"
echo "  npm test              - Run all tests"
echo "  npm run test:watch    - Run tests in watch mode"
echo "  npm run test:coverage - Run tests with coverage report"
echo "  npm run test:ci       - Run tests for CI/CD"
echo ""
echo "🚀 The testing environment is ready for development!"
