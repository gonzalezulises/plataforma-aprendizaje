#!/bin/bash

# ============================================================================
# Plataforma de Aprendizaje - Environment Setup Script
# ============================================================================
# This script sets up the development environment for the learning platform.
# It installs dependencies, configures the database, and starts dev servers.
# ============================================================================

set -e  # Exit on any error

echo "========================================"
echo "  Plataforma de Aprendizaje Setup"
echo "========================================"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status messages
print_status() {
    echo -e "${GREEN}[OK]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
check_node() {
    echo "Checking Node.js installation..."
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v)
        print_status "Node.js is installed: $NODE_VERSION"

        # Check minimum version (18+)
        MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | tr -d 'v')
        if [ "$MAJOR_VERSION" -lt 18 ]; then
            print_warning "Node.js 18+ is recommended. Current version: $NODE_VERSION"
        fi
    else
        print_error "Node.js is not installed. Please install Node.js 18+ first."
        echo "Download from: https://nodejs.org/"
        exit 1
    fi
}

# Check if npm is installed
check_npm() {
    echo "Checking npm installation..."
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm -v)
        print_status "npm is installed: $NPM_VERSION"
    else
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi
}

# Check if Docker is installed (optional for code execution sandbox)
check_docker() {
    echo "Checking Docker installation..."
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version)
        print_status "Docker is installed: $DOCKER_VERSION"

        # Check if Docker daemon is running
        if docker info &> /dev/null; then
            print_status "Docker daemon is running"
        else
            print_warning "Docker daemon is not running. Code execution sandbox will not work."
        fi
    else
        print_warning "Docker is not installed. Code execution sandbox will not work."
        echo "For full functionality, install Docker from: https://docker.com/"
    fi
}

# Install backend dependencies
install_backend() {
    echo ""
    echo "Installing backend dependencies..."
    if [ -d "backend" ]; then
        cd backend
        npm install
        print_status "Backend dependencies installed"
        cd ..
    else
        print_warning "Backend directory not found. Skipping backend setup."
    fi
}

# Install frontend dependencies
install_frontend() {
    echo ""
    echo "Installing frontend dependencies..."
    if [ -d "frontend" ]; then
        cd frontend
        npm install
        print_status "Frontend dependencies installed"
        cd ..
    else
        print_warning "Frontend directory not found. Skipping frontend setup."
    fi
}

# Setup database
setup_database() {
    echo ""
    echo "Setting up SQLite database..."
    if [ -d "backend" ]; then
        cd backend

        # Create database directory if it doesn't exist
        mkdir -p data

        # Run migrations if migration script exists
        if [ -f "package.json" ] && grep -q "migrate" package.json; then
            npm run migrate 2>/dev/null || print_warning "Migration script not found or failed"
        fi

        # Run seeds if seed script exists
        if [ -f "package.json" ] && grep -q "seed" package.json; then
            npm run seed 2>/dev/null || print_warning "Seed script not found or failed"
        fi

        print_status "Database setup complete"
        cd ..
    else
        print_warning "Backend directory not found. Skipping database setup."
    fi
}

# Create .env files if they don't exist
setup_env() {
    echo ""
    echo "Setting up environment variables..."

    # Backend .env
    if [ -d "backend" ] && [ ! -f "backend/.env" ]; then
        if [ -f "backend/.env.example" ]; then
            cp backend/.env.example backend/.env
            print_status "Created backend/.env from example"
        else
            cat > backend/.env << EOF
# Database
DATABASE_PATH=./data/learning_platform.db

# Server
PORT=3001
NODE_ENV=development

# Session
SESSION_SECRET=your-session-secret-change-in-production

# OAuth (rizo.ma integration)
OAUTH_CLIENT_ID=your-client-id
OAUTH_CLIENT_SECRET=your-client-secret
OAUTH_CALLBACK_URL=http://localhost:3001/api/auth/callback

# Code Execution (Docker)
CODE_EXEC_TIMEOUT=30000
CODE_EXEC_MEMORY_LIMIT=256m

# Storage (Cloudflare R2 or Backblaze B2)
STORAGE_ENDPOINT=
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=
STORAGE_BUCKET=

# Google Meet API
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
EOF
            print_status "Created backend/.env with default values"
        fi
    fi

    # Frontend .env
    if [ -d "frontend" ] && [ ! -f "frontend/.env" ]; then
        if [ -f "frontend/.env.example" ]; then
            cp frontend/.env.example frontend/.env
            print_status "Created frontend/.env from example"
        else
            cat > frontend/.env << EOF
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001
EOF
            print_status "Created frontend/.env with default values"
        fi
    fi
}

# Start development servers
start_servers() {
    echo ""
    echo "========================================"
    echo "  Starting Development Servers"
    echo "========================================"
    echo ""

    # Check if we're in a terminal that supports background processes
    if [ -d "backend" ] && [ -d "frontend" ]; then
        echo "To start the development servers, run:"
        echo ""
        echo "  # Terminal 1 - Backend:"
        echo "  cd backend && npm run dev"
        echo ""
        echo "  # Terminal 2 - Frontend:"
        echo "  cd frontend && npm run dev"
        echo ""
        echo "Or use the combined command (if available):"
        echo "  npm run dev"
        echo ""
        echo "========================================"
        echo "  Access Points"
        echo "========================================"
        echo "  Frontend:  http://localhost:5173"
        echo "  Backend:   http://localhost:3001"
        echo "  API Docs:  http://localhost:3001/api/docs (if enabled)"
        echo "========================================"
    else
        print_warning "Project structure not complete. Please set up frontend and backend directories first."
    fi
}

# Main execution
main() {
    echo "Starting setup process..."
    echo ""

    check_node
    check_npm
    check_docker

    install_backend
    install_frontend

    setup_env
    setup_database

    start_servers

    echo ""
    print_status "Setup complete!"
    echo ""
}

# Run main function
main
