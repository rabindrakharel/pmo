#!/bin/bash
# ============================================================================
# Cohuron Platform - Complete Automated Deployment
# Domain: ${domain_name}
# App URL: https://${app_subdomain}.${domain_name}
# ============================================================================

set -e
exec > >(tee /var/log/user-data.log) 2>&1

echo "============================================================================"
echo "Starting Huron PMO Complete Deployment"
echo "Domain: ${domain_name}"
echo "App Subdomain: ${app_subdomain}"
echo "Timestamp: $(date)"
echo "============================================================================"

# ============================================================================
# System Update and Basic Tools
# ============================================================================

echo "📦 Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get upgrade -y
apt-get install -y \
    curl \
    wget \
    git \
    unzip \
    jq \
    build-essential \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release

# ============================================================================
# Install Node.js 20 LTS
# ============================================================================

echo "📦 Installing Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node --version
npm --version

# Install pnpm (faster package manager)
npm install -g pnpm
pnpm --version

# ============================================================================
# Install Docker and Docker Compose
# ============================================================================

echo "🐳 Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
systemctl enable docker
systemctl start docker
usermod -aG docker ubuntu

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
docker-compose --version

# ============================================================================
# Install PostgreSQL Client
# ============================================================================

echo "🐘 Installing PostgreSQL client..."
apt-get install -y postgresql-client-14

# ============================================================================
# Install Nginx
# ============================================================================

echo "🌐 Installing Nginx..."
apt-get install -y nginx
systemctl enable nginx
systemctl start nginx

# ============================================================================
# Install PM2 for Process Management
# ============================================================================

echo "⚙️  Installing PM2..."
npm install -g pm2
pm2 startup systemd -u ubuntu --hp /home/ubuntu

# ============================================================================
# Install AWS CLI v2
# ============================================================================

echo "☁️  Installing AWS CLI v2..."
cd /tmp
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip -q awscliv2.zip
./aws/install
aws --version

# ============================================================================
# Setup Application Directory
# ============================================================================

echo "📁 Setting up application directory..."
mkdir -p /opt/${project_name}
chown -R ubuntu:ubuntu /opt/${project_name}

# ============================================================================
# Clone Application Code
# ============================================================================

echo "📥 Cloning application code..."
cd /opt/${project_name}

%{ if github_repo_url != "" ~}
# Clone from GitHub
sudo -u ubuntu git clone ${github_repo_url} .
%{ else ~}
# Placeholder - will be manually deployed
echo "No GitHub repo URL provided. Application code must be deployed manually."
mkdir -p apps/api apps/web db tools
chown -R ubuntu:ubuntu /opt/${project_name}
%{ endif ~}

# ============================================================================
# Configure Environment Variables
# ============================================================================

echo "⚙️  Configuring environment variables..."

# API Environment
cat > /opt/${project_name}/apps/api/.env <<EOF
# Database Configuration
DB_HOST=${db_host}
DB_PORT=${db_port}
DB_NAME=${db_name}
DB_USER=${db_user}
DB_PASSWORD=${db_password}

# Application
NODE_ENV=production
PORT=4000
API_URL=https://${app_subdomain}.${domain_name}

# JWT Configuration
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=86400

# AWS Configuration
AWS_REGION=${aws_region}
S3_BUCKET=${s3_bucket}

# Redis (Docker)
REDIS_HOST=localhost
REDIS_PORT=6379

# MinIO (Docker)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minio
MINIO_SECRET_KEY=minio123

# MailHog (Docker)
SMTP_HOST=localhost
SMTP_PORT=1025
EMAIL_FROM=noreply@${domain_name}
EOF

# Web Environment
cat > /opt/${project_name}/apps/web/.env <<EOF
VITE_API_URL=https://${app_subdomain}.${domain_name}
VITE_API_BASE_URL=https://${app_subdomain}.${domain_name}
EOF

chown ubuntu:ubuntu /opt/${project_name}/apps/api/.env
chown ubuntu:ubuntu /opt/${project_name}/apps/web/.env

# ============================================================================
# Install Dependencies
# ============================================================================

echo "📦 Installing application dependencies..."
cd /opt/${project_name}

%{ if github_repo_url != "" ~}
sudo -u ubuntu pnpm install || sudo -u ubuntu npm install

# Install API dependencies
cd apps/api
sudo -u ubuntu pnpm install || sudo -u ubuntu npm install
cd ../..

# Install Web dependencies
cd apps/web
sudo -u ubuntu pnpm install || sudo -u ubuntu npm install
cd ../..
%{ endif ~}

# ============================================================================
# Build Applications
# ============================================================================

echo "🔨 Building applications..."

%{ if github_repo_url != "" ~}
# Build API
cd /opt/${project_name}/apps/api
sudo -u ubuntu pnpm build || sudo -u ubuntu npm run build
cd ../..

# Build Web
cd /opt/${project_name}/apps/web
sudo -u ubuntu pnpm build || sudo -u ubuntu npm run build
cd ../..
%{ endif ~}

# ============================================================================
# Setup Docker Services
# ============================================================================

echo "🐳 Starting Docker services..."
cd /opt/${project_name}

# Create docker-compose.yml if it doesn't exist
cat > docker-compose.yml <<'DOCKEREOF'
version: '3.8'

services:
  postgres:
    image: postgres:14
    container_name: ${project_name}_db
    environment:
      POSTGRES_DB: ${db_name}
      POSTGRES_USER: ${db_user}
      POSTGRES_PASSWORD: ${db_password}
    ports:
      - "5434:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: ${project_name}_redis
    ports:
      - "6379:6379"
    restart: unless-stopped

  minio:
    image: minio/minio
    container_name: ${project_name}_minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minio
      MINIO_ROOT_PASSWORD: minio123
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
    restart: unless-stopped

  mailhog:
    image: mailhog/mailhog
    container_name: ${project_name}_mailhog
    ports:
      - "1025:1025"
      - "8025:8025"
    restart: unless-stopped

volumes:
  postgres_data:
  minio_data:
DOCKEREOF

sudo -u ubuntu docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for Docker services to be ready..."
sleep 30

# ============================================================================
# Initialize Database
# ============================================================================

echo "🗄️  Initializing database..."
cd /opt/${project_name}

%{ if github_repo_url != "" ~}
# Run database import script if it exists
if [ -f "tools/db-import.sh" ]; then
    sudo -u ubuntu bash tools/db-import.sh || echo "Database import failed, continuing..."
fi
%{ endif ~}

# ============================================================================
# Setup PM2 Ecosystem
# ============================================================================

echo "⚙️  Configuring PM2..."
cat > /opt/${project_name}/ecosystem.config.js <<'PM2EOF'
module.exports = {
  apps: [
    {
      name: '${project_name}-api',
      cwd: '/opt/${project_name}/apps/api',
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
      error_file: '/var/log/${project_name}/api-error.log',
      out_file: '/var/log/${project_name}/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: '${project_name}-web',
      cwd: '/opt/${project_name}/apps/web',
      script: 'npm',
      args: 'run preview -- --port 5173 --host 0.0.0.0',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/var/log/${project_name}/web-error.log',
      out_file: '/var/log/${project_name}/web-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
PM2EOF

chown ubuntu:ubuntu /opt/${project_name}/ecosystem.config.js
mkdir -p /var/log/${project_name}
chown -R ubuntu:ubuntu /var/log/${project_name}

# ============================================================================
# Configure Nginx
# ============================================================================

echo "🌐 Configuring Nginx..."
cat > /etc/nginx/sites-available/${project_name} <<'NGINXEOF'
server {
    listen 80;
    listen [::]:80;
    server_name ${app_subdomain}.${domain_name};

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Client max body size
    client_max_body_size 100M;

    # API proxy
    location /api/ {
        proxy_pass http://localhost:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Web application
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
NGINXEOF

# Enable site
ln -sf /etc/nginx/sites-available/${project_name} /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
nginx -t
systemctl reload nginx

# ============================================================================
# Start Applications with PM2
# ============================================================================

echo "🚀 Starting applications..."
cd /opt/${project_name}

%{ if github_repo_url != "" ~}
sudo -u ubuntu pm2 start ecosystem.config.js
sudo -u ubuntu pm2 save
%{ endif ~}

# ============================================================================
# Install and Configure Certbot (Let's Encrypt)
# ============================================================================

echo "🔒 Installing Certbot for SSL..."
apt-get install -y certbot python3-certbot-nginx

# Note: SSL certificate will be obtained after DNS propagates
# Create a script for manual SSL setup
cat > /root/setup-ssl.sh <<'SSLEOF'
#!/bin/bash
# Run this script after DNS has propagated

echo "Setting up SSL certificate for ${app_subdomain}.${domain_name}..."

# Obtain certificate
certbot --nginx \
  -d ${app_subdomain}.${domain_name} \
  --email admin@${domain_name} \
  --agree-tos \
  --non-interactive \
  --redirect

# Update web .env to use HTTPS
sed -i 's|http://|https://|g' /opt/${project_name}/apps/web/.env

# Rebuild web app
cd /opt/${project_name}/apps/web
sudo -u ubuntu npm run build

# Restart PM2
sudo -u ubuntu pm2 restart ${project_name}-web

echo "SSL setup complete!"
SSLEOF

chmod +x /root/setup-ssl.sh

# ============================================================================
# Setup Helper Scripts
# ============================================================================

echo "📝 Creating helper scripts..."

# Status check script
cat > /usr/local/bin/${project_name}-status <<'STATUSEOF'
#!/bin/bash
echo "============================================================================"
echo "Cohuron Platform Status"
echo "============================================================================"
echo ""
echo "PM2 Processes:"
sudo -u ubuntu pm2 status
echo ""
echo "Docker Services:"
docker-compose -f /opt/${project_name}/docker-compose.yml ps
echo ""
echo "Nginx Status:"
systemctl status nginx --no-pager | head -10
echo ""
echo "Disk Usage:"
df -h | grep -E '^/dev/'
echo ""
echo "Memory Usage:"
free -h
echo "============================================================================"
STATUSEOF
chmod +x /usr/local/bin/${project_name}-status

# Logs viewer script
cat > /usr/local/bin/${project_name}-logs <<'LOGSEOF'
#!/bin/bash
TYPE=$${1:-all}

if [ "$TYPE" = "api" ]; then
    sudo -u ubuntu pm2 logs ${project_name}-api --lines 100
elif [ "$TYPE" = "web" ]; then
    sudo -u ubuntu pm2 logs ${project_name}-web --lines 100
else
    sudo -u ubuntu pm2 logs --lines 50
fi
LOGSEOF
chmod +x /usr/local/bin/${project_name}-logs

# Restart script
cat > /usr/local/bin/${project_name}-restart <<'RESTARTEOF'
#!/bin/bash
echo "Restarting Huron PMO services..."
sudo -u ubuntu pm2 restart all
systemctl restart nginx
echo "Services restarted!"
RESTARTEOF
chmod +x /usr/local/bin/${project_name}-restart

# ============================================================================
# Setup Automated Backups
# ============================================================================

echo "💾 Configuring automated backups..."
cat > /usr/local/bin/${project_name}-backup <<'BACKUPEOF'
#!/bin/bash
BACKUP_DIR="/tmp/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/${project_name}_$TIMESTAMP.sql"

mkdir -p $BACKUP_DIR

# Backup database
PGPASSWORD=${db_password} pg_dump \
  -h ${db_host} \
  -U ${db_user} \
  -d ${db_name} \
  -F c \
  -f $BACKUP_FILE

# Upload to S3
aws s3 cp $BACKUP_FILE s3://${s3_bucket}/backups/

# Keep local backups for 7 days
find $BACKUP_DIR -name "${project_name}_*.sql" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE"
BACKUPEOF
chmod +x /usr/local/bin/${project_name}-backup

# Schedule daily backups at 2 AM
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/${project_name}-backup >> /var/log/${project_name}-backup.log 2>&1") | crontab -

# ============================================================================
# Final Configuration
# ============================================================================

echo "🔧 Final configuration..."

# Set proper permissions
chown -R ubuntu:ubuntu /opt/${project_name}

# Create info file
cat > /opt/${project_name}/DEPLOYMENT_INFO.txt <<EOF
============================================================================
Cohuron Platform - Deployment Information
============================================================================

Deployed: $(date)
Domain: ${domain_name}
App URL: https://${app_subdomain}.${domain_name}

Database:
  Host: ${db_host}
  Port: ${db_port}
  Name: ${db_name}
  User: ${db_user}

S3 Bucket: ${s3_bucket}
AWS Region: ${aws_region}

Services:
  API: http://localhost:4000
  Web: http://localhost:5173
  Nginx: http://localhost:80

Helper Commands:
  ${project_name}-status    - Check service status
  ${project_name}-logs      - View application logs
  ${project_name}-restart   - Restart all services
  ${project_name}-backup    - Manual backup

SSL Setup:
  Run after DNS propagates: /root/setup-ssl.sh

============================================================================
EOF

# ============================================================================
# Completion
# ============================================================================

echo "============================================================================"
echo "✅ Cohuron Platform Deployment Complete!"
echo "============================================================================"
echo ""
echo "Next Steps:"
echo "1. Wait for DNS to propagate (5-60 minutes)"
echo "2. Run: /root/setup-ssl.sh"
echo "3. Access your app at: https://${app_subdomain}.${domain_name}"
echo ""
echo "Useful Commands:"
echo "  ${project_name}-status  - Check service status"
echo "  ${project_name}-logs    - View logs"
echo "  ${project_name}-restart - Restart services"
echo ""
echo "Deployment log: /var/log/user-data.log"
echo "============================================================================"

# Mark completion
touch /var/lib/cloud/instance/deployment-complete
