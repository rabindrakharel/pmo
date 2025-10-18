#!/bin/bash
# ============================================================================
# Coherent PMO Platform - EC2 User Data Script
# ============================================================================
# This script runs on first boot of the EC2 instance to:
# - Install system dependencies (Node.js, PostgreSQL client, Docker, etc.)
# - Configure environment variables
# - Clone/deploy the application
# - Set up systemd services for auto-start
# ============================================================================

set -e  # Exit on error

# Logging
exec > >(tee /var/log/user-data.log)
exec 2>&1

echo "============================================"
echo "Coherent PMO Platform - Instance Setup"
echo "Starting at: $(date)"
echo "============================================"

# ============================================================================
# System Update and Basic Tools
# ============================================================================

echo "Updating system packages..."
apt-get update -y
apt-get upgrade -y

echo "Installing basic tools..."
apt-get install -y \
  curl \
  wget \
  git \
  unzip \
  jq \
  build-essential \
  ca-certificates \
  gnupg \
  lsb-release

# ============================================================================
# Install Node.js (v20.x LTS)
# ============================================================================

echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

# ============================================================================
# Install PostgreSQL Client
# ============================================================================

echo "Installing PostgreSQL client..."
apt-get install -y postgresql-client

# ============================================================================
# Install Docker and Docker Compose
# ============================================================================

echo "Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
usermod -aG docker ubuntu

echo "Installing Docker Compose..."
DOCKER_COMPOSE_VERSION="v2.24.5"
curl -L "https://github.com/docker/compose/releases/download/$${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose

# ============================================================================
# Install AWS CLI
# ============================================================================

echo "Installing AWS CLI..."
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install
rm -rf aws awscliv2.zip

# ============================================================================
# Install PM2 Process Manager
# ============================================================================

echo "Installing PM2..."
npm install -g pm2
pm2 startup systemd -u ubuntu --hp /home/ubuntu

# ============================================================================
# Configure Application Directory
# ============================================================================

echo "Setting up application directory..."
APP_DIR="/opt/coherent"
mkdir -p $APP_DIR
chown -R ubuntu:ubuntu $APP_DIR

# ============================================================================
# Create Environment Configuration
# ============================================================================

echo "Creating environment configuration..."

cat > $APP_DIR/.env <<EOF
# Database Configuration
DB_HOST=${db_host}
DB_PORT=${db_port}
DB_NAME=${db_name}
DB_USER=${db_user}
DB_PASSWORD=${db_password}
DATABASE_URL=postgresql://${db_user}:${db_password}@${db_host}:${db_port}/${db_name}

# AWS Configuration
AWS_REGION=${aws_region}
S3_BUCKET=${s3_bucket}

# Application Configuration
NODE_ENV=production
API_PORT=4000
WEB_PORT=5173

# JWT Configuration (CHANGE THESE IN PRODUCTION!)
JWT_SECRET=$(openssl rand -base64 32)

# Redis Configuration (if using local Redis)
REDIS_HOST=localhost
REDIS_PORT=6379

# MinIO Configuration (if using local MinIO)
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minio
MINIO_SECRET_KEY=minio123
MINIO_BUCKET=coherent-artifacts

# Email Configuration (MailHog for dev, configure SMTP for prod)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=noreply@coherent.local
EOF

chown ubuntu:ubuntu $APP_DIR/.env
chmod 600 $APP_DIR/.env

# ============================================================================
# Create Deployment Script
# ============================================================================

echo "Creating deployment script..."

cat > $APP_DIR/deploy.sh <<'DEPLOY_SCRIPT'
#!/bin/bash
set -e

APP_DIR="/opt/coherent"
REPO_URL="https://github.com/YOUR_ORG/coherent.git"  # UPDATE THIS!
BRANCH="main"

echo "============================================"
echo "Coherent PMO Platform - Deployment"
echo "Starting at: $(date)"
echo "============================================"

cd $APP_DIR

# Clone or pull latest code
if [ -d "$APP_DIR/pmo" ]; then
  echo "Updating existing repository..."
  cd pmo
  git fetch origin
  git checkout $BRANCH
  git pull origin $BRANCH
else
  echo "Cloning repository..."
  git clone -b $BRANCH $REPO_URL pmo
  cd pmo
fi

# Copy environment file
cp ../.env .env

# Install dependencies
echo "Installing dependencies..."
npm install

# Install workspace dependencies
cd apps/api && npm install && cd ../..
cd apps/web && npm install && cd ../..

# Build API
echo "Building API..."
cd apps/api
npm run build || true  # Continue even if build fails (TypeScript)
cd ../..

# Build Web
echo "Building Web application..."
cd apps/web
npm run build
cd ../..

# Initialize database
echo "Initializing database..."
cd db
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f 00_schema.sql || true
for ddl in *.ddl; do
  echo "Loading $ddl..."
  PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f $ddl || true
done
cd ..

# Restart PM2 services
echo "Restarting services..."
pm2 delete all || true
pm2 start ecosystem.config.js
pm2 save

echo "Deployment completed at: $(date)"
DEPLOY_SCRIPT

chmod +x $APP_DIR/deploy.sh
chown ubuntu:ubuntu $APP_DIR/deploy.sh

# ============================================================================
# Create PM2 Ecosystem Configuration
# ============================================================================

echo "Creating PM2 ecosystem configuration..."

cat > $APP_DIR/ecosystem.config.js <<'PM2_CONFIG'
module.exports = {
  apps: [
    {
      name: 'coherent-api',
      cwd: '/opt/coherent/pmo/apps/api',
      script: 'npm',
      args: 'start',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 4000
      },
      error_file: '/opt/coherent/logs/api-error.log',
      out_file: '/opt/coherent/logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'coherent-web',
      cwd: '/opt/coherent/pmo/apps/web',
      script: 'npm',
      args: 'run preview',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 5173
      },
      error_file: '/opt/coherent/logs/web-error.log',
      out_file: '/opt/coherent/logs/web-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
PM2_CONFIG

chown ubuntu:ubuntu $APP_DIR/ecosystem.config.js

# ============================================================================
# Create Logs Directory
# ============================================================================

mkdir -p $APP_DIR/logs
chown -R ubuntu:ubuntu $APP_DIR/logs

# ============================================================================
# Install and Configure Nginx (Reverse Proxy)
# ============================================================================

echo "Installing Nginx..."
apt-get install -y nginx

echo "Configuring Nginx..."

cat > /etc/nginx/sites-available/coherent <<'NGINX_CONFIG'
server {
    listen 80;
    server_name _;

    client_max_body_size 50M;

    # API requests
    location /api/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # API docs
    location /docs {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Web application
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX_CONFIG

ln -sf /etc/nginx/sites-available/coherent /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl restart nginx
systemctl enable nginx

# ============================================================================
# Setup CloudWatch Agent (Optional)
# ============================================================================

echo "Installing CloudWatch Agent..."
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
dpkg -i -E ./amazon-cloudwatch-agent.deb
rm amazon-cloudwatch-agent.deb

# ============================================================================
# Create Update Script
# ============================================================================

cat > /usr/local/bin/coherent-update <<'UPDATE_SCRIPT'
#!/bin/bash
set -e
cd /opt/coherent
sudo -u ubuntu ./deploy.sh
UPDATE_SCRIPT

chmod +x /usr/local/bin/coherent-update

# ============================================================================
# Setup Daily Backup Script
# ============================================================================

cat > /usr/local/bin/coherent-backup <<'BACKUP_SCRIPT'
#!/bin/bash
set -e

BACKUP_DIR="/opt/coherent/backups"
mkdir -p $BACKUP_DIR

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/coherent_db_$TIMESTAMP.sql"

echo "Creating database backup: $BACKUP_FILE"
PGPASSWORD=${db_password} pg_dump -h ${db_host} -U ${db_user} -d ${db_name} > $BACKUP_FILE

# Upload to S3
aws s3 cp $BACKUP_FILE s3://${s3_bucket}/backups/

# Keep only last 7 days of local backups
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE"
BACKUP_SCRIPT

chmod +x /usr/local/bin/coherent-backup

# Add to crontab (daily at 2 AM)
echo "0 2 * * * /usr/local/bin/coherent-backup >> /var/log/coherent-backup.log 2>&1" | crontab -u ubuntu -

# ============================================================================
# Create Helper Scripts
# ============================================================================

# Status script
cat > /usr/local/bin/coherent-status <<'STATUS_SCRIPT'
#!/bin/bash
echo "============================================"
echo "Coherent PMO Platform - Status"
echo "============================================"
echo ""
echo "PM2 Processes:"
sudo -u ubuntu pm2 status
echo ""
echo "Nginx Status:"
systemctl status nginx --no-pager
echo ""
echo "Database Connection:"
PGPASSWORD=${db_password} psql -h ${db_host} -U ${db_user} -d ${db_name} -c "SELECT version();" || echo "Database connection failed"
echo ""
echo "Disk Usage:"
df -h /opt/coherent
STATUS_SCRIPT

chmod +x /usr/local/bin/coherent-status

# Logs script
cat > /usr/local/bin/coherent-logs <<'LOGS_SCRIPT'
#!/bin/bash
if [ "$1" == "api" ]; then
  sudo -u ubuntu pm2 logs coherent-api
elif [ "$1" == "web" ]; then
  sudo -u ubuntu pm2 logs coherent-web
else
  sudo -u ubuntu pm2 logs
fi
LOGS_SCRIPT

chmod +x /usr/local/bin/coherent-logs

# ============================================================================
# Finalize Setup
# ============================================================================

echo "============================================"
echo "Setup completed successfully!"
echo "============================================"
echo ""
echo "Next steps:"
echo "1. SSH into the instance: ssh ubuntu@<instance-ip>"
echo "2. Update repository URL in /opt/coherent/deploy.sh"
echo "3. Run: sudo /opt/coherent/deploy.sh"
echo "4. Check status: coherent-status"
echo "5. View logs: coherent-logs"
echo ""
echo "Useful commands:"
echo "  coherent-status  - Show application status"
echo "  coherent-logs    - View application logs"
echo "  coherent-update  - Pull latest code and redeploy"
echo "  coherent-backup  - Manual database backup"
echo ""
echo "Setup completed at: $(date)"
