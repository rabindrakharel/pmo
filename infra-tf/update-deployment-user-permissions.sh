#!/bin/bash

# Script to update deployment-user IAM permissions for SES and SNS
# Run this with your AWS admin profile

set -e

POLICY_NAME="DeploymentUserSESSNSPolicy"
USER_NAME="deployment-user"
POLICY_FILE="deployment-user-ses-sns-permissions.json"
AWS_PROFILE="${AWS_PROFILE:-cohuron}"

echo "==============================================="
echo "Updating IAM permissions for $USER_NAME"
echo "==============================================="

# Check if policy file exists
if [ ! -f "$POLICY_FILE" ]; then
    echo "Error: Policy file $POLICY_FILE not found!"
    exit 1
fi

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --profile $AWS_PROFILE --query Account --output text)
echo "AWS Account ID: $ACCOUNT_ID"

# Create or update IAM policy
echo ""
echo "Step 1: Creating/updating IAM policy..."

# Check if policy already exists
POLICY_ARN="arn:aws:iam::$ACCOUNT_ID:policy/$POLICY_NAME"
if aws iam get-policy --policy-arn "$POLICY_ARN" --profile $AWS_PROFILE &>/dev/null; then
    echo "Policy already exists. Creating new version..."

    # Delete old versions if there are 5 (AWS limit)
    VERSION_COUNT=$(aws iam list-policy-versions --policy-arn "$POLICY_ARN" --profile $AWS_PROFILE --query 'Versions | length(@)' --output text)
    if [ "$VERSION_COUNT" -eq 5 ]; then
        echo "Deleting oldest policy version..."
        OLDEST_VERSION=$(aws iam list-policy-versions --policy-arn "$POLICY_ARN" --profile $AWS_PROFILE --query 'Versions[-1].VersionId' --output text)
        aws iam delete-policy-version --policy-arn "$POLICY_ARN" --version-id "$OLDEST_VERSION" --profile $AWS_PROFILE
    fi

    # Create new version and set as default
    aws iam create-policy-version \
        --policy-arn "$POLICY_ARN" \
        --policy-document file://"$POLICY_FILE" \
        --set-as-default \
        --profile $AWS_PROFILE
    echo "✓ Policy updated successfully"
else
    echo "Creating new policy..."
    aws iam create-policy \
        --policy-name "$POLICY_NAME" \
        --policy-document file://"$POLICY_FILE" \
        --description "Permissions for SES, SNS, and SMS for deployment user" \
        --profile $AWS_PROFILE
    echo "✓ Policy created successfully"
fi

# Attach policy to user
echo ""
echo "Step 2: Attaching policy to user $USER_NAME..."

# Check if already attached
if aws iam list-attached-user-policies --user-name "$USER_NAME" --profile $AWS_PROFILE --query "AttachedPolicies[?PolicyArn=='$POLICY_ARN']" --output text | grep -q "$POLICY_NAME"; then
    echo "Policy already attached to user"
else
    aws iam attach-user-policy \
        --user-name "$USER_NAME" \
        --policy-arn "$POLICY_ARN" \
        --profile $AWS_PROFILE
    echo "✓ Policy attached successfully"
fi

echo ""
echo "==============================================="
echo "✓ Permissions updated successfully!"
echo "==============================================="
echo ""
echo "The deployment-user now has permissions for:"
echo "  - AWS SES (Simple Email Service)"
echo "  - AWS SNS (Simple Notification Service)"
echo "  - SMS/Voice messaging"
echo "  - IAM policy management"
echo "  - Route 53 DNS records"
echo "  - CloudWatch Logs"
echo ""
echo "You can now run: terraform apply"
echo ""
