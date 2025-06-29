#!/bin/bash

# AuraSAFE Setup Script
# Automated setup for development and production environments

set -e

echo "🚀 Setting up AuraSAFE - Predictive Urban Safety Engine"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}[SETUP]${NC} $1"
}

# Check if running on supported OS
check_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        OS="windows"
    else
        print_error "Unsupported operating system: $OSTYPE"
        exit 1
    fi
    print_status "Detected OS: $OS"
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking prerequisites..."
    
    # Check Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_status "Node.js found: $NODE_VERSION"
    else
        print_error "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
        exit 1
    fi
    
    # Check npm
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        print_status "npm found: $NPM_VERSION"
    else
        print_error "npm is not installed. Please install npm."
        exit 1
    fi
    
    # Check Python
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version)
        print_status "Python found: $PYTHON_VERSION"
    else
        print_error "Python 3.9+ is not installed. Please install Python from https://python.org/"
        exit 1
    fi
    
    # Check Docker (optional)
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version)
        print_status "Docker found: $DOCKER_VERSION"
        DOCKER_AVAILABLE=true
    else
        print_warning "Docker not found. Docker deployment will not be available."
        DOCKER_AVAILABLE=false
    fi
    
    # Check Git
    if command -v git &> /dev/null; then
        GIT_VERSION=$(git --version)
        print_status "Git found: $GIT_VERSION"
    else
        print_error "Git is not installed. Please install Git."
        exit 1
    fi
}

# Setup environment files
setup_environment() {
    print_header "Setting up environment files..."
    
    # Frontend environment
    if [ ! -f .env ]; then
        print_status "Creating frontend .env file..."
        cp .env.example .env
        print_warning "Please edit .env file with your Supabase configuration"
    else
        print_status "Frontend .env file already exists"
    fi
    
    # Backend environment
    if [ ! -f backend/.env ]; then
        print_status "Creating backend .env file..."
        cp backend/.env.example backend/.env
        print_warning "Please edit backend/.env file with your configuration"
    else
        print_status "Backend .env file already exists"
    fi
}

# Install frontend dependencies
install_frontend() {
    print_header "Installing frontend dependencies..."
    npm install
    print_status "Frontend dependencies installed successfully"
}

# Install backend dependencies
install_backend() {
    print_header "Installing backend dependencies..."
    cd backend
    
    # Create virtual environment if it doesn't exist
    if [ ! -d "venv" ]; then
        print_status "Creating Python virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    print_status "Activating virtual environment..."
    source venv/bin/activate
    
    # Install dependencies
    print_status "Installing Python dependencies..."
    pip install --upgrade pip
    pip install -r requirements.txt
    
    cd ..
    print_status "Backend dependencies installed successfully"
}

# Setup database
setup_database() {
    print_header "Setting up database..."
    
    if [ "$DOCKER_AVAILABLE" = true ]; then
        print_status "Starting MongoDB with Docker..."
        docker run -d --name aurasafe-mongo -p 27017:27017 mongo:7.0
        print_status "MongoDB started on port 27017"
        
        print_status "Starting Redis with Docker..."
        docker run -d --name aurasafe-redis -p 6379:6379 redis:7.2-alpine
        print_status "Redis started on port 6379"
    else
        print_warning "Docker not available. Please install MongoDB and Redis manually:"
        print_warning "MongoDB: https://docs.mongodb.com/manual/installation/"
        print_warning "Redis: https://redis.io/download"
    fi
}

# Build frontend
build_frontend() {
    print_header "Building frontend for production..."
    npm run build
    print_status "Frontend built successfully"
}

# Run tests
run_tests() {
    print_header "Running tests..."
    
    # Frontend tests
    print_status "Running frontend tests..."
    npm test -- --watchAll=false
    
    # Backend tests
    print_status "Running backend tests..."
    cd backend
    source venv/bin/activate
    pytest
    cd ..
    
    print_status "All tests passed successfully"
}

# Start development servers
start_dev_servers() {
    print_header "Starting development servers..."
    
    print_status "Starting backend server..."
    cd backend
    source venv/bin/activate
    uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
    BACKEND_PID=$!
    cd ..
    
    sleep 5
    
    print_status "Starting frontend server..."
    npm run dev &
    FRONTEND_PID=$!
    
    print_status "Development servers started!"
    print_status "Frontend: http://localhost:5173"
    print_status "Backend: http://localhost:8000"
    print_status "API Docs: http://localhost:8000/docs"
    
    # Wait for user input to stop servers
    echo ""
    print_warning "Press Ctrl+C to stop the servers"
    
    # Trap Ctrl+C to clean up processes
    trap 'kill $BACKEND_PID $FRONTEND_PID; exit' INT
    wait
}

# Docker setup
setup_docker() {
    if [ "$DOCKER_AVAILABLE" = true ]; then
        print_header "Setting up Docker environment..."
        
        print_status "Building Docker images..."
        docker-compose build
        
        print_status "Starting services with Docker Compose..."
        docker-compose up -d
        
        print_status "Docker services started!"
        print_status "Frontend: http://localhost:3000"
        print_status "Backend: http://localhost:8000"
        print_status "MongoDB: localhost:27017"
        print_status "Redis: localhost:6379"
        
        print_status "To view logs: docker-compose logs -f"
        print_status "To stop services: docker-compose down"
    else
        print_warning "Docker not available. Skipping Docker setup."
    fi
}

# Main setup function
main() {
    echo "🛡️ AuraSAFE Setup Script"
    echo "=========================="
    echo ""
    
    check_os
    check_prerequisites
    setup_environment
    
    echo ""
    echo "Choose setup option:"
    echo "1) Development setup (manual)"
    echo "2) Development setup (Docker)"
    echo "3) Production build"
    echo "4) Run tests only"
    echo "5) Full setup (development + tests)"
    echo ""
    read -p "Enter your choice (1-5): " choice
    
    case $choice in
        1)
            install_frontend
            install_backend
            setup_database
            start_dev_servers
            ;;
        2)
            setup_docker
            ;;
        3)
            install_frontend
            install_backend
            build_frontend
            print_status "Production build completed!"
            ;;
        4)
            install_frontend
            install_backend
            run_tests
            ;;
        5)
            install_frontend
            install_backend
            setup_database
            run_tests
            build_frontend
            print_status "Full setup completed!"
            ;;
        *)
            print_error "Invalid choice. Please run the script again."
            exit 1
            ;;
    esac
    
    echo ""
    print_status "Setup completed successfully! 🎉"
    echo ""
    print_status "Next steps:"
    print_status "1. Configure your .env files with actual values"
    print_status "2. Set up your Supabase project"
    print_status "3. Configure your MongoDB and Redis connections"
    print_status "4. Start developing!"
    echo ""
    print_status "For help, visit: https://github.com/yourusername/aurasafe"
}

# Run main function
main "$@"