#!/bin/bash
# ============================================================================
# Cohuron Platform - Automated Code Deployment Script
# ============================================================================
# This script bundles the current git branch and uploads to S3
# Triggers Lambda via EventBridge for automated EC2 deployment
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}Cohuron Platform - Code Deployment${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# Check if we're in a git repository
if [ ! -d "$PROJECT_ROOT/.git" ]; then
    echo -e "${RED}ERROR: Not in a git repository!${NC}"
    exit 1
fi

# Get current branch
CURRENT_BRANCH=$(git -C "$PROJECT_ROOT" rev-parse --abbrev-ref HEAD)
COMMIT_HASH=$(git -C "$PROJECT_ROOT" rev-parse --short HEAD)
COMMIT_MESSAGE=$(git -C "$PROJECT_ROOT" log -1 --pretty=%B | head -1)

echo -e "${GREEN}Git Information:${NC}"
echo "  Branch: $CURRENT_BRANCH"
echo "  Commit: $COMMIT_HASH"
echo "  Message: $COMMIT_MESSAGE"
echo ""

# Get S3 bucket name from Terraform
cd "$SCRIPT_DIR"
echo -e "${YELLOW}Getting deployment bucket from Terraform...${NC}"
S3_BUCKET=$(terraform output -raw s3_code_bucket_name 2>/dev/null)

if [ -z "$S3_BUCKET" ]; then
    echo -e "${RED}ERROR: Could not get S3 bucket name from Terraform${NC}"
    echo "Run 'terraform apply' first to create deployment infrastructure"
    exit 1
fi

echo "  S3 Bucket: $S3_BUCKET"
echo ""

# Create deployment bundle
BUNDLE_NAME="cohuron-${CURRENT_BRANCH}-${COMMIT_HASH}-${TIMESTAMP}.tar.gz"
TEMP_DIR=$(mktemp -d)

echo -e "${YELLOW}Creating deployment bundle...${NC}"
echo "  Temp directory: $TEMP_DIR"
echo "  Bundle name: $BUNDLE_NAME"
echo ""

# Copy project files (excluding unnecessary files)
cd "$PROJECT_ROOT"

echo -e "${YELLOW}Bundling project files...${NC}"

# Create tarball excluding unnecessary files
tar -czf "$TEMP_DIR/$BUNDLE_NAME" \
    --exclude=".git" \
    --exclude="node_modules" \
    --exclude=".next" \
    --exclude="dist" \
    --exclude="build" \
    --exclude=".env.local" \
    --exclude=".env.*.local" \
    --exclude="*.log" \
    --exclude=".terraform" \
    --exclude="terraform.tfstate*" \
    --exclude=".DS_Store" \
    --exclude="coverage" \
    --exclude=".cache" \
    --exclude="tmp" \
    --exclude="*.tar.gz" \
    .

BUNDLE_SIZE=$(du -h "$TEMP_DIR/$BUNDLE_NAME" | cut -f1)
echo -e "${GREEN}✓ Bundle created: $BUNDLE_SIZE${NC}"
echo ""

# Upload to S3
echo -e "${YELLOW}Uploading to S3...${NC}"
echo "  Destination: s3://$S3_BUCKET/$BUNDLE_NAME"

aws s3 cp "$TEMP_DIR/$BUNDLE_NAME" "s3://$S3_BUCKET/$BUNDLE_NAME" \
    --metadata "branch=$CURRENT_BRANCH,commit=$COMMIT_HASH,timestamp=$TIMESTAMP"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Upload successful!${NC}"
else
    echo -e "${RED}ERROR: Upload failed!${NC}"
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo ""

# Cleanup
rm -rf "$TEMP_DIR"

# Get deployment info
LAMBDA_FUNCTION=$(terraform output -raw lambda_deployer_function 2>/dev/null)
LOG_GROUP=$(terraform output -raw lambda_deployer_logs 2>/dev/null)
EC2_INSTANCE=$(terraform output -raw ec2_instance_id 2>/dev/null)
EC2_IP=$(terraform output -raw ec2_public_ip 2>/dev/null)

echo -e "${GREEN}============================================================================${NC}"
echo -e "${GREEN}Deployment Initiated!${NC}"
echo -e "${GREEN}============================================================================${NC}"
echo ""
echo -e "${BLUE}Deployment Details:${NC}"
echo "  Branch: $CURRENT_BRANCH"
echo "  Commit: $COMMIT_HASH"
echo "  Bundle: $BUNDLE_NAME"
echo "  Size: $BUNDLE_SIZE"
echo ""
echo -e "${BLUE}AWS Resources:${NC}"
echo "  S3 Bucket: $S3_BUCKET"
echo "  Lambda: $LAMBDA_FUNCTION"
echo "  EC2 Instance: $EC2_INSTANCE"
echo "  EC2 IP: $EC2_IP"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. EventBridge will trigger Lambda automatically (~30 seconds)"
echo "  2. Lambda will deploy code to EC2 via SSM"
echo "  3. Services will be restarted automatically"
echo ""
echo -e "${YELLOW}Monitor Deployment:${NC}"
echo "  View Lambda logs:"
echo "    ${BLUE}aws logs tail $LOG_GROUP --follow${NC}"
echo ""
echo "  SSH into EC2:"
echo "    ${BLUE}ssh -i ~/.ssh/id_ed25519 ubuntu@$EC2_IP${NC}"
echo ""
echo "  Check deployment log on EC2:"
echo "    ${BLUE}tail -f /var/log/cohuron-deployment.log${NC}"
echo ""
echo "  View SSM command history:"
echo "    ${BLUE}aws ssm list-commands --instance-id $EC2_INSTANCE --max-results 5${NC}"
echo ""
echo -e "${GREEN}✓ Deployment automation triggered successfully!${NC}"
echo -e "${GREEN}============================================================================${NC}"
