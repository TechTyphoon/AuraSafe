#!/bin/bash

# AuraSAFE Production Deployment Script
# Automated deployment for production environments

set -e

echo "🚀 Starting AuraSAFE production deployment..."

# Configuration
PROJECT_NAME="aurasafe"
DOMAIN="${DOMAIN:-yourdomain.com}"
BACKEND_PORT="8000"
FRONTEND_PORT="3000"
ENVIRONMENT="${ENVIRONMENT:-production}"

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
    echo -e "${BLUE}[DEPLOY]${NC} $1"
}

# Check if running as root
check_user() {
    if [[ $EUID -eq 0 ]]; then
       print_error "This script should not be run as root for security reasons"
       exit 1
    fi
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking deployment prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check if user is in docker group
    if ! groups $USER | grep &>/dev/null '\bdocker\b'; then
        print_error "User $USER is not in the docker group. Please add user to docker group:"
        print_error "sudo usermod -aG docker $USER"
        print_error "Then log out and log back in."
        exit 1
    fi
    
    print_status "All prerequisites met"
}

# Validate environment files
validate_environment() {
    print_header "Validating environment configuration..."
    
    # Check if environment files exist
    if [ ! -f .env ]; then
        print_error ".env file not found. Creating from template..."
        cp .env.example .env
        print_warning "Please edit .env file with your production configuration before continuing."
        exit 1
    fi
    
    if [ ! -f backend/.env ]; then
        print_error "backend/.env file not found. Creating from template..."
        cp backend/.env.example backend/.env
        print_warning "Please edit backend/.env file with your production configuration before continuing."
        exit 1
    fi
    
    # Load environment variables
    source .env
    
    # Validate required environment variables
    required_vars=("VITE_SUPABASE_URL" "VITE_SUPABASE_ANON_KEY")
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            print_error "Required environment variable $var is not set in .env"
            exit 1
        fi
    done
    
    # Load backend environment variables
    source backend/.env
    
    # Validate backend required environment variables
    backend_required_vars=("SUPABASE_URL" "SUPABASE_SERVICE_KEY" "JWT_SECRET")
    for var in "${backend_required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            print_error "Required environment variable $var is not set in backend/.env"
            exit 1
        fi
    done
    
    print_status "Environment variables validated"
}

# Backup existing deployment
backup_deployment() {
    print_header "Creating backup of existing deployment..."
    
    BACKUP_DIR="/var/backups/aurasafe"
    DATE=$(date +%Y%m%d_%H%M%S)
    
    sudo mkdir -p $BACKUP_DIR
    
    # Backup database if running
    if docker ps | grep -q aurasafe-mongodb; then
        print_status "Backing up MongoDB..."
        docker exec aurasafe-mongodb mongodump --out /tmp/backup
        docker cp aurasafe-mongodb:/tmp/backup $BACKUP_DIR/mongodb_$DATE
    fi
    
    # Backup application files
    if [ -d "/opt/aurasafe" ]; then
        print_status "Backing up application files..."
        sudo tar -czf $BACKUP_DIR/app_$DATE.tar.gz /opt/aurasafe
    fi
    
    print_status "Backup completed: $BACKUP_DIR"
}

# Pull latest code
update_code() {
    print_header "Updating application code..."
    
    # Pull latest changes
    git fetch origin
    git pull origin main
    
    print_status "Code updated successfully"
}

# Build and deploy with Docker
deploy_docker() {
    print_header "Building and deploying with Docker..."
    
    # Stop existing services
    print_status "Stopping existing services..."
    docker-compose -f docker-compose.prod.yml down || true
    
    # Remove old images
    print_status "Cleaning up old images..."
    docker system prune -f
    
    # Build new images
    print_status "Building Docker images..."
    docker-compose -f docker-compose.prod.yml build --no-cache
    
    # Start services
    print_status "Starting services..."
    docker-compose -f docker-compose.prod.yml up -d
    
    # Wait for services to be ready
    print_status "Waiting for services to start..."
    sleep 30
    
    # Check if services are running
    if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
        print_status "Services are running successfully!"
    else
        print_error "Some services failed to start. Check logs with: docker-compose -f docker-compose.prod.yml logs"
        exit 1
    fi
}

# Setup SSL certificates
setup_ssl() {
    if [ "$1" = "--ssl" ]; then
        print_header "Setting up SSL certificates..."
        
        # Install certbot if not present
        if ! command -v certbot &> /dev/null; then
            print_status "Installing certbot..."
            sudo apt-get update
            sudo apt-get install -y certbot python3-certbot-nginx
        fi
        
        # Generate SSL certificate
        print_status "Generating SSL certificate for $DOMAIN..."
        sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
        
        print_status "SSL certificates configured"
    fi
}

# Configure firewall
setup_firewall() {
    print_header "Configuring firewall..."
    
    # Install ufw if not present
    if ! command -v ufw &> /dev/null; then
        sudo apt-get update
        sudo apt-get install -y ufw
    fi
    
    # Configure firewall rules
    sudo ufw allow 22/tcp   # SSH
    sudo ufw allow 80/tcp   # HTTP
    sudo ufw allow 443/tcp  # HTTPS
    sudo ufw --force enable
    
    print_status "Firewall configured"
}

# Setup monitoring
setup_monitoring() {
    print_header "Setting up monitoring and logging..."
    
    # Create log directories
    sudo mkdir -p /var/log/aurasafe
    sudo chown $USER:$USER /var/log/aurasafe
    
    # Setup log rotation
    sudo tee /etc/logrotate.d/aurasafe > /dev/null <<EOF
/var/log/aurasafe/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 $USER $USER
    postrotate
        docker-compose -f docker-compose.prod.yml restart nginx
    endscript
}
EOF
    
    print_status "Monitoring and logging configured"
}

# Create backup script
create_backup_script() {
    print_header "Creating automated backup script..."
    
    sudo tee /usr/local/bin/aurasafe-backup > /dev/null <<EOF
#!/bin/bash
BACKUP_DIR="/var/backups/aurasafe"
DATE=\$(date +%Y%m%d_%H%M%S)

mkdir -p \$BACKUP_DIR

# Backup MongoDB
if docker ps | grep -q aurasafe-mongodb; then
    docker exec aurasafe-mongodb mongodump --out /tmp/backup
    docker cp aurasafe-mongodb:/tmp/backup \$BACKUP_DIR/mongodb_\$DATE
fi

# Backup application files
if [ -d "/opt/aurasafe" ]; then
    tar -czf \$BACKUP_DIR/app_\$DATE.tar.gz /opt/aurasafe
fi

# Keep only last 7 days of backups
find \$BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: \$DATE"
EOF
    
    sudo chmod +x /usr/local/bin/aurasafe-backup
    
    # Setup cron job for daily backups
    (crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/aurasafe-backup") | crontab -
    
    print_status "Automated backup configured"
}

# Create monitoring script
create_monitoring_script() {
    print_header "Creating health monitoring script..."
    
    sudo tee /usr/local/bin/aurasafe-monitor > /dev/null <<EOF
#!/bin/bash
# Check if all services are running
if ! docker-compose -f /opt/aurasafe/docker-compose.prod.yml ps | grep -q "Up"; then
    echo "AuraSAFE services are down. Restarting..."
    cd /opt/aurasafe
    docker-compose -f docker-compose.prod.yml restart
    
    # Send notification (configure with your preferred method)
    # Example: Send email or Slack notification
    echo "AuraSAFE services were restarted on \$(hostname) at \$(date)" | mail -s "AuraSAFE Service Alert" admin@$DOMAIN
fi
EOF
    
    sudo chmod +x /usr/local/bin/aurasafe-monitor
    
    # Setup monitoring cron job (every 5 minutes)
    (crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/aurasafe-monitor") | crontab -
    
    print_status "Health monitoring configured"
}

# Setup reverse proxy
setup_reverse_proxy() {
    print_header "Configuring reverse proxy..."
    
    # Create nginx configuration for production
    sudo tee /etc/nginx/sites-available/aurasafe > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    location /docs {
        proxy_pass http://localhost:8000/docs;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
    
    # Enable the site
    sudo ln -sf /etc/nginx/sites-available/aurasafe /etc/nginx/sites-enabled/
    sudo nginx -t && sudo systemctl reload nginx
    
    print_status "Reverse proxy configured"
}

# Health check
health_check() {
    print_header "Performing health check..."
    
    # Check frontend
    if curl -f http://localhost:3000/health &>/dev/null; then
        print_status "Frontend health check: PASSED"
    else
        print_warning "Frontend health check: FAILED"
    fi
    
    # Check backend
    if curl -f http://localhost:8000/health &>/dev/null; then
        print_status "Backend health check: PASSED"
    else
        print_warning "Backend health check: FAILED"
    fi
    
    # Check database
    if docker exec aurasafe-mongodb mongo --eval "db.adminCommand('ismaster')" &>/dev/null; then
        print_status "Database health check: PASSED"
    else
        print_warning "Database health check: FAILED"
    fi
}

# Display deployment information
show_deployment_info() {
    print_header "Deployment completed successfully! 🎉"
    echo ""
    echo "🌐 Application URLs:"
    echo "   Frontend: http://$DOMAIN"
    echo "   Backend API: http://$DOMAIN/api"
    echo "   API Documentation: http://$DOMAIN/docs"
    echo ""
    echo "🐳 Docker Commands:"
    echo "   View logs: docker-compose -f docker-compose.prod.yml logs -f"
    echo "   Restart services: docker-compose -f docker-compose.prod.yml restart"
    echo "   Stop services: docker-compose -f docker-compose.prod.yml down"
    echo "   Update application: git pull && docker-compose -f docker-compose.prod.yml build && docker-compose -f docker-compose.prod.yml up -d"
    echo ""
    echo "🔧 Management:"
    echo "   Manual backup: /usr/local/bin/aurasafe-backup"
    echo "   Health monitor: /usr/local/bin/aurasafe-monitor"
    echo ""
    echo "📊 Monitoring:"
    echo "   System status: docker-compose -f docker-compose.prod.yml ps"
    echo "   Resource usage: docker stats"
    echo "   Application logs: docker-compose -f docker-compose.prod.yml logs -f"
    echo ""
    
    if [ "$1" = "--ssl" ]; then
        echo "🔒 SSL Certificate:"
        echo "   HTTPS enabled: https://$DOMAIN"
        echo "   Automatic renewal configured"
        echo "   Test renewal: sudo certbot renew --dry-run"
        echo ""
    fi
    
    print_status "AuraSAFE is now running in production mode!"
    echo ""
    print_warning "Important next steps:"
    print_warning "1. Configure your domain DNS to point to this server"
    print_warning "2. Update Supabase settings with your production domain"
    print_warning "3. Set up monitoring alerts and notifications"
    print_warning "4. Configure backup storage (S3, etc.)"
    print_warning "5. Set up log aggregation and monitoring"
}

# Main deployment function
main() {
    echo "🛡️ AuraSAFE Production Deployment"
    echo "=================================="
    echo ""
    
    check_user
    check_prerequisites
    validate_environment
    
    # Parse command line arguments
    SSL_ENABLED=false
    BACKUP_ENABLED=true
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --ssl)
                SSL_ENABLED=true
                shift
                ;;
            --no-backup)
                BACKUP_ENABLED=false
                shift
                ;;
            --domain)
                DOMAIN="$2"
                shift 2
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Usage: $0 [--ssl] [--no-backup] [--domain DOMAIN]"
                exit 1
                ;;
        esac
    done
    
    print_status "Deploying to domain: $DOMAIN"
    
    if [ "$BACKUP_ENABLED" = true ]; then
        backup_deployment
    fi
    
    update_code
    deploy_docker
    
    if [ "$SSL_ENABLED" = true ]; then
        setup_ssl --ssl
    fi
    
    setup_firewall
    setup_monitoring
    create_backup_script
    create_monitoring_script
    
    # Wait for services to stabilize
    sleep 10
    
    health_check
    
    if [ "$SSL_ENABLED" = true ]; then
        show_deployment_info --ssl
    else
        show_deployment_info
    fi
}

# Run main function with all arguments
main "$@"