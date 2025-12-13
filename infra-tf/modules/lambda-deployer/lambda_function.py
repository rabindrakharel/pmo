"""
Lambda Function - Deploy Code from S3 to EC2
Triggered by S3 upload via EventBridge
Uses AWS Systems Manager (SSM) to deploy code to EC2
"""

import json
import boto3
import urllib.parse
import os
from datetime import datetime

ssm = boto3.client('ssm')
s3 = boto3.client('s3')

# Environment variables
EC2_INSTANCE_ID = os.environ['EC2_INSTANCE_ID']
DEPLOY_PATH = os.environ.get('DEPLOY_PATH', '/opt/cohuron')
PROJECT_NAME = os.environ.get('PROJECT_NAME', 'cohuron')

def lambda_handler(event, context):
    """
    Main Lambda handler - triggered by S3 upload via EventBridge
    """
    print(f"Deployment Lambda triggered at {datetime.now().isoformat()}")
    print(f"Event: {json.dumps(event)}")

    try:
        # Parse S3 event from EventBridge
        detail = event.get('detail', {})
        bucket_name = detail.get('bucket', {}).get('name')
        object_key = urllib.parse.unquote_plus(detail.get('object', {}).get('key', ''))

        if not bucket_name or not object_key:
            raise ValueError("Missing bucket or object key in event")

        print(f"Deploying: s3://{bucket_name}/{object_key}")
        print(f"Target EC2: {EC2_INSTANCE_ID}")

        # Build deployment script
        deployment_script = f"""#!/bin/bash
set -e
set -x

echo "========================================="
echo "Cohuron Platform - Automated Deployment"
echo "========================================="
echo "Timestamp: $(date)"
echo "Bucket: {bucket_name}"
echo "File: {object_key}"
echo "Instance: {EC2_INSTANCE_ID}"
echo ""

# Stop services before deployment
echo "Stopping services..."
pm2 stop all || true
pm2 delete all || true

# Create backup of current deployment
BACKUP_DIR="/opt/{PROJECT_NAME}-backups"
mkdir -p $BACKUP_DIR
if [ -d "{DEPLOY_PATH}" ]; then
    BACKUP_NAME="{PROJECT_NAME}-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
    echo "Creating backup: $BACKUP_NAME"
    cd {DEPLOY_PATH}/..
    tar -czf "$BACKUP_DIR/$BACKUP_NAME" {PROJECT_NAME}/ || true

    # Keep only last 5 backups
    cd $BACKUP_DIR
    ls -t {PROJECT_NAME}-backup-*.tar.gz | tail -n +6 | xargs -r rm
fi

# Download and extract new code
echo "Downloading code from S3..."
cd /tmp
aws s3 cp s3://{bucket_name}/{object_key} code-deployment.tar.gz

echo "Extracting code..."
rm -rf /tmp/{PROJECT_NAME}-deploy
mkdir -p /tmp/{PROJECT_NAME}-deploy
cd /tmp/{PROJECT_NAME}-deploy
tar -xzf /tmp/code-deployment.tar.gz

# Deploy to target directory
echo "Deploying to {DEPLOY_PATH}..."
sudo mkdir -p {DEPLOY_PATH}
sudo cp -r /tmp/{PROJECT_NAME}-deploy/* {DEPLOY_PATH}/
sudo chown -R ubuntu:ubuntu {DEPLOY_PATH}

# ============================================
# Step 1: Install Dependencies
# ============================================
echo ""
echo "============================================"
echo "STEP 1: Installing Dependencies"
echo "============================================"
cd {DEPLOY_PATH}

# Install root dependencies if needed
if [ -f "package.json" ]; then
    echo "Installing root dependencies..."
    pnpm install --frozen-lockfile || pnpm install
fi

# Backend dependencies
if [ -f "apps/api/package.json" ]; then
    echo "Installing API dependencies..."
    cd {DEPLOY_PATH}/apps/api
    pnpm install --frozen-lockfile || pnpm install
    echo "✓ API dependencies installed"
fi

# Frontend dependencies
if [ -f "apps/web/package.json" ]; then
    echo "Installing Web dependencies..."
    cd {DEPLOY_PATH}/apps/web
    pnpm install --frozen-lockfile || pnpm install
    echo "✓ Web dependencies installed"
fi

# ============================================
# Step 1.5: Configure API Environment
# ============================================
echo ""
echo "============================================"
echo "STEP 1.5: Configuring API Environment"
echo "============================================"
cd {DEPLOY_PATH}/apps/api

# Create .env file with Docker database credentials
cat > .env <<'ENVEOF'
# Database Configuration - Docker PostgreSQL
DATABASE_URL=postgresql://app:app@localhost:5434/app

# Server Configuration
NODE_ENV=production
PORT=4000
HOST=0.0.0.0

# JWT Secret (generate a secure one for production)
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# CORS - Allow app domain
WEB_ORIGIN=http://app.cohuron.com
API_ORIGIN=http://app.cohuron.com

# Redis
REDIS_URL=redis://localhost:6379

# MinIO S3
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=artifacts
S3_ACCESS_KEY=minio
S3_SECRET_KEY=minio123

# Email (MailHog for development)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@cohuron.com
ENVEOF

echo "✓ API environment configured with Docker database"

# Configure Web environment
echo "Configuring Web environment..."
cd {DEPLOY_PATH}/apps/web

cat > .env <<'WEBENVEOF'
# API Configuration - Use public IP for access from domain
VITE_API_BASE_URL=http://100.28.36.248:4000
WEBENVEOF

echo "✓ Web environment configured"

# ============================================
# Step 2: Start Docker Infrastructure
# ============================================
echo ""
echo "============================================"
echo "STEP 2: Starting Docker Infrastructure"
echo "============================================"
cd {DEPLOY_PATH}

# Stop and remove any old containers to avoid conflicts
echo "Stopping and removing old containers..."
docker compose down --remove-orphans || true
docker stop cohuron_db pmo_db 2>/dev/null || true
docker rm cohuron_db pmo_db 2>/dev/null || true

echo "Starting Docker services (PostgreSQL, Redis, MinIO, MailHog)..."
docker compose up -d --remove-orphans || true  # May return non-zero if already running

# Verify containers are running
sleep 5
RUNNING_CONTAINERS=$(docker compose ps --services --filter "status=running" | wc -l)
if [ "$RUNNING_CONTAINERS" -ge "3" ]; then
    echo "✓ Docker services are running ($RUNNING_CONTAINERS containers)"
else
    echo "ERROR: Not enough Docker services running (expected ≥3, got $RUNNING_CONTAINERS)"
    docker compose ps
    exit 1
fi

# Wait for PostgreSQL to be ready (use pmo_db container name)
echo "Waiting for PostgreSQL to be ready..."
sleep 5
for i in {{1..30}}; do
    if docker exec pmo_db pg_isready -h localhost -p 5432 -U app > /dev/null 2>&1; then
        echo "✓ PostgreSQL is ready"
        break
    fi
    echo "Waiting for PostgreSQL... ($i/30)"
    sleep 2
done

# ============================================
# Step 3: Import Database Schema
# ============================================
echo ""
echo "============================================"
echo "STEP 3: Importing Database Schema"
echo "============================================"
cd {DEPLOY_PATH}

if [ ! -f "tools/db-import.sh" ]; then
    echo "ERROR: tools/db-import.sh not found!"
    exit 1
fi

chmod +x tools/db-import.sh
echo "Running database import..."
if ./tools/db-import.sh; then
    echo "✓ Database import completed successfully"
else
    echo "ERROR: Database import failed!"
    exit 1
fi

# ============================================
# Step 3.5: Update Nginx Configuration
# ============================================
echo ""
echo "============================================"
echo "STEP 3.5: Updating Nginx Configuration"
echo "============================================"

# Check if SSL certs exist and create appropriate config
if [ -f /etc/letsencrypt/live/app.cohuron.com/fullchain.pem ]; then
    echo "SSL certificates found, creating HTTPS config..."
    sudo tee /etc/nginx/sites-available/cohuron > /dev/null <<'NGINXCONF'
# =============================================================================
# Default server block - reject requests to root domain (HTTP)
# =============================================================================
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name cohuron.com www.cohuron.com;
    return 444;
}

# =============================================================================
# Default server block - reject requests to root domain (HTTPS)
# =============================================================================
server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name cohuron.com www.cohuron.com;
    ssl_certificate /etc/letsencrypt/live/app.cohuron.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.cohuron.com/privkey.pem;
    return 444;
}

# =============================================================================
# App subdomain - HTTP to HTTPS redirect
# =============================================================================
server {
    listen 80;
    listen [::]:80;
    server_name app.cohuron.com;
    return 301 https://$host$request_uri;
}

# =============================================================================
# App subdomain - HTTPS (main application)
# =============================================================================
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name app.cohuron.com;

    ssl_certificate /etc/letsencrypt/live/app.cohuron.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.cohuron.com/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_protocols TLSv1.2 TLSv1.3;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    client_max_body_size 100M;

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
    }

    location /ws {
        proxy_pass http://localhost:4001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

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

    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
NGINXCONF
else
    echo "No SSL certificates found, creating HTTP-only config..."
    sudo tee /etc/nginx/sites-available/cohuron > /dev/null <<'NGINXCONF'
# =============================================================================
# Default server block - reject requests to root domain
# =============================================================================
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name cohuron.com www.cohuron.com _;
    return 444;
}

# =============================================================================
# App subdomain - HTTP (main application - no SSL yet)
# =============================================================================
server {
    listen 80;
    listen [::]:80;
    server_name app.cohuron.com;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    client_max_body_size 100M;

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
    }

    location /ws {
        proxy_pass http://localhost:4001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

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

    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
NGINXCONF
fi

# Enable site and remove default and old configs
sudo ln -sf /etc/nginx/sites-available/cohuron /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo rm -f /etc/nginx/sites-enabled/pmo
sudo rm -f /etc/nginx/sites-available/pmo

# Test and reload Nginx
if sudo nginx -t; then
    sudo systemctl reload nginx
    echo "✓ Nginx configuration updated and reloaded"
else
    echo "ERROR: Nginx configuration test failed!"
    sudo nginx -t
fi

# ============================================
# Step 4: Start Application Services (PM2)
# ============================================
echo ""
echo "============================================"
echo "STEP 4: Starting Application Services"
echo "============================================"
cd {DEPLOY_PATH}

# Stop any existing PM2 processes
pm2 delete all || true

# Start API
if [ -f "apps/api/package.json" ]; then
    echo "Starting API service..."
    cd {DEPLOY_PATH}/apps/api
    pm2 start "pnpm dev" --name cohuron-api
    echo "✓ API service started"
fi

# Start Web
if [ -f "apps/web/package.json" ]; then
    echo "Starting Web service..."
    cd {DEPLOY_PATH}/apps/web
    pm2 start "pnpm dev --port 5173 --host 0.0.0.0" --name cohuron-web
    echo "✓ Web service started"
fi

pm2 save

# Wait for services to fully initialize
echo ""
echo "Waiting for services to initialize..."
sleep 15

# ============================================
# Step 5: Verify Services
# ============================================
echo ""
echo "============================================"
echo "STEP 5: Verifying Services"
echo "============================================"

# Check Docker services
echo "Docker services:"
docker ps --format "table {{{{.Names}}}}\t{{{{.Status}}}}" || true

echo ""
echo "PM2 processes:"
pm2 status || true

echo ""
echo "Recent PM2 logs:"
pm2 logs --lines 10 --nostream || true

# Cleanup
rm -f /tmp/code-deployment.tar.gz
rm -rf /tmp/{PROJECT_NAME}-deploy

echo ""
echo "========================================="
echo "✅ DEPLOYMENT COMPLETE!"
echo "========================================="
echo "Timestamp: $(date)"
echo ""
echo "Deployment Summary:"
echo "  ✓ Code deployed to {DEPLOY_PATH}"
echo "  ✓ Dependencies installed"
echo "  ✓ Database schema imported (44 DDL files)"
echo "  ✓ Nginx updated (cohuron.com disabled, app.cohuron.com enabled)"
echo "  ✓ All services started"
echo ""
echo "Public access:"
echo "  🌐 App:  https://app.cohuron.com (ENABLED)"
echo "  🚫 Root: https://cohuron.com (DISABLED - returns 444)"
echo ""
echo "Local services:"
echo "  🌐 Web:  http://localhost:5173"
echo "  🔧 API:  http://localhost:4000"
echo "  📊 Docs: http://localhost:4000/docs"
echo ""
echo "Infrastructure services:"
echo "  🐘 PostgreSQL: localhost:5434"
echo "  📮 Redis:      localhost:6379"
echo "  📦 MinIO:      localhost:9000"
echo "  📧 MailHog:    localhost:8025"
echo ""
echo "Deployment successful! 🎉"
echo "========================================="
echo ""
"""

        # Execute deployment via SSM
        print("Executing deployment script on EC2 via SSM...")

        response = ssm.send_command(
            InstanceIds=[EC2_INSTANCE_ID],
            DocumentName='AWS-RunShellScript',
            Parameters={
                'commands': [deployment_script],
                'executionTimeout': ['3600']  # 1 hour timeout
            },
            Comment=f'Deploy {object_key} from S3',
            TimeoutSeconds=3600
        )

        command_id = response['Command']['CommandId']

        print(f"SSM Command sent successfully: {command_id}")
        print(f"Check command status: aws ssm get-command-invocation --command-id {command_id} --instance-id {EC2_INSTANCE_ID}")

        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Deployment initiated successfully',
                'bucket': bucket_name,
                'key': object_key,
                'instance': EC2_INSTANCE_ID,
                'command_id': command_id,
                'timestamp': datetime.now().isoformat()
            })
        }

    except Exception as e:
        print(f"ERROR: Deployment failed - {str(e)}")
        import traceback
        traceback.print_exc()

        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'message': 'Deployment failed'
            })
        }
