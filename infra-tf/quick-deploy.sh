#!/bin/bash
# ============================================================================
# Coherent PMO Platform - Quick Deploy Script
# ============================================================================
# This script automates the initial deployment process
# ============================================================================

set -e

echo "============================================"
echo "Coherent PMO Platform - Quick Deploy"
echo "============================================"
echo ""

# Check if Terraform is installed
if ! command -v terraform &> /dev/null; then
    echo "ERROR: Terraform is not installed!"
    echo "Install from: https://www.terraform.io/downloads"
    exit 1
fi

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "ERROR: AWS CLI is not installed!"
    echo "Install from: https://aws.amazon.com/cli/"
    exit 1
fi

# Check AWS credentials
echo "Checking AWS credentials..."
if ! aws sts get-caller-identity &> /dev/null; then
    echo "ERROR: AWS credentials not configured!"
    echo "Run: aws configure"
    exit 1
fi

AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region)
echo "✓ AWS Account: $AWS_ACCOUNT"
echo "✓ AWS Region: $AWS_REGION"
echo ""

# Check if terraform.tfvars exists
if [ ! -f terraform.tfvars ]; then
    echo "Creating terraform.tfvars from example..."
    cp terraform.tfvars.example terraform.tfvars
    echo ""
    echo "⚠️  IMPORTANT: Edit terraform.tfvars with your values!"
    echo ""
    echo "Required changes:"
    echo "  1. db_password - Set a strong database password"
    echo "  2. ec2_public_key - Paste your SSH public key"
    echo "  3. ssh_allowed_cidr - Restrict to your IP address"
    echo ""
    echo "Generate SSH key: ssh-keygen -t rsa -b 4096 -f ~/.ssh/coherent-key"
    echo "Get your IP: curl ifconfig.me"
    echo ""
    read -p "Press Enter after editing terraform.tfvars to continue..."
fi

# Validate terraform.tfvars
echo "Validating configuration..."
if grep -q "CHANGE_ME_IN_PRODUCTION" terraform.tfvars; then
    echo "ERROR: Please update db_password in terraform.tfvars!"
    exit 1
fi

if grep -q "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQC..." terraform.tfvars; then
    echo "ERROR: Please update ec2_public_key in terraform.tfvars!"
    exit 1
fi

echo "✓ Configuration validated"
echo ""

# Initialize Terraform
echo "Initializing Terraform..."
terraform init
echo ""

# Validate Terraform configuration
echo "Validating Terraform configuration..."
terraform validate
echo ""

# Show plan
echo "Generating deployment plan..."
terraform plan -out=tfplan
echo ""

# Confirm deployment
echo "============================================"
echo "Ready to deploy infrastructure!"
echo "============================================"
echo ""
echo "Resources to be created:"
echo "  - VPC with public and private subnets"
echo "  - EC2 instance (application server)"
echo "  - RDS PostgreSQL database"
echo "  - S3 bucket for artifacts"
echo "  - Security groups and IAM roles"
echo ""
echo "Estimated cost: ~\$40-80/month (depending on usage)"
echo "Deployment time: ~10-15 minutes"
echo ""
read -p "Do you want to proceed with deployment? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Deployment cancelled."
    exit 0
fi

# Apply Terraform
echo ""
echo "Deploying infrastructure..."
terraform apply tfplan
echo ""

# Save outputs
echo "Saving outputs..."
terraform output -json > outputs.json
terraform output > outputs.txt

# Display summary
echo ""
echo "============================================"
echo "Deployment Complete!"
echo "============================================"
echo ""
echo "Infrastructure Summary:"
echo "-----------------------"
terraform output deployment_summary
echo ""

EC2_IP=$(terraform output -raw ec2_public_ip)
echo "Next Steps:"
echo "-----------"
echo "1. SSH into EC2 instance:"
echo "   ssh -i ~/.ssh/coherent-key ubuntu@$EC2_IP"
echo ""
echo "2. Wait for user-data script to complete:"
echo "   sudo tail -f /var/log/user-data.log"
echo ""
echo "3. Update repository URL:"
echo "   sudo nano /opt/coherent/deploy.sh"
echo ""
echo "4. Deploy application:"
echo "   sudo /opt/coherent/deploy.sh"
echo ""
echo "5. Check status:"
echo "   coherent-status"
echo ""
echo "Documentation:"
echo "  - Quick Start: ./infra-tf/README.md"
echo "  - Full Guide: ./infra-tf/DEPLOYMENT.md"
echo ""
echo "Outputs saved to:"
echo "  - outputs.json (machine-readable)"
echo "  - outputs.txt (human-readable)"
echo ""
