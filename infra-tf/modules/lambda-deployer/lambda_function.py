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

# Install dependencies
echo "Installing dependencies..."
cd {DEPLOY_PATH}

# Backend dependencies
if [ -f "apps/api/package.json" ]; then
    echo "Installing API dependencies..."
    cd {DEPLOY_PATH}/apps/api
    pnpm install --frozen-lockfile || pnpm install
fi

# Frontend dependencies
if [ -f "apps/web/package.json" ]; then
    echo "Installing Web dependencies..."
    cd {DEPLOY_PATH}/apps/web
    pnpm install --frozen-lockfile || pnpm install
fi

# Run database import
echo "Running database import..."
cd {DEPLOY_PATH}
if [ -f "tools/db-import.sh" ]; then
    chmod +x tools/db-import.sh
    ./tools/db-import.sh || echo "Warning: db-import failed, continuing..."
else
    echo "Warning: tools/db-import.sh not found"
fi

# Start all services using start-all script
echo "Starting all services..."
cd {DEPLOY_PATH}
if [ -f "tools/start-all.sh" ]; then
    chmod +x tools/start-all.sh
    ./tools/start-all.sh || echo "Warning: start-all failed, continuing..."
else
    echo "Warning: tools/start-all.sh not found"
fi

# Wait for services to start
sleep 10

# Check service status via PM2
echo "Checking service status..."
pm2 status || true
pm2 logs --lines 20 --nostream || true

# Cleanup
rm -f /tmp/code-deployment.tar.gz
rm -rf /tmp/{PROJECT_NAME}-deploy

echo ""
echo "========================================="
echo "✅ Deployment Complete!"
echo "========================================="
echo "Timestamp: $(date)"
echo "Services should be running at:"
echo "  API: http://localhost:4000"
echo "  Web: http://localhost:5173"
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
