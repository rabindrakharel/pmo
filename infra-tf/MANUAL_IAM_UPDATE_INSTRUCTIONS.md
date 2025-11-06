# Manual IAM Permission Update Instructions

The `deployment-user` needs additional IAM permissions to create SES and SNS resources. Follow these steps to update the permissions.

## Option 1: AWS Console (Easiest)

1. **Login to AWS Console** with an admin account
   - Go to https://console.aws.amazon.com/

2. **Navigate to IAM**
   - Go to IAM → Policies → Create Policy

3. **Create the Policy**
   - Click "JSON" tab
   - Copy the entire contents of `deployment-user-ses-sns-permissions.json`
   - Paste into the JSON editor
   - Click "Next"
   - Name: `DeploymentUserSESSNSPolicy`
   - Description: `Permissions for SES, SNS, and SMS for deployment user`
   - Click "Create policy"

4. **Attach to deployment-user**
   - Go to IAM → Users → deployment-user
   - Click "Permissions" tab
   - Click "Add permissions" → "Attach policies directly"
   - Search for `DeploymentUserSESSNSPolicy`
   - Select the checkbox
   - Click "Add permissions"

5. **Verify**
   - Run: `terraform apply` in the infra-tf directory

---

## Option 2: AWS CLI with Admin Profile

If you have an AWS admin profile configured (not the deployment-user profile):

```bash
cd /home/rabin/projects/pmo/infra-tf

# Replace 'admin' with your admin profile name
export AWS_PROFILE=admin  # or your admin profile name

# Run the update script
./update-deployment-user-permissions.sh
```

---

## Option 3: AWS CLI Manual Commands

If you prefer to run the commands manually:

```bash
# Get your AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Create the IAM policy
aws iam create-policy \
  --policy-name DeploymentUserSESSNSPolicy \
  --policy-document file://deployment-user-ses-sns-permissions.json \
  --description "Permissions for SES, SNS, and SMS for deployment user"

# Attach the policy to deployment-user
aws iam attach-user-policy \
  --user-name deployment-user \
  --policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/DeploymentUserSESSNSPolicy
```

---

## Permissions Being Added

The policy grants the following permissions:

### SES (Email Service)
- Full SES access for domain verification, email sending, configuration sets

### SNS (Notification Service)
- Full SNS access for topic management, SMS sending

### SMS/Voice
- SMS and voice messaging capabilities
- Mobile targeting (Pinpoint)

### IAM
- Create and manage IAM policies
- Attach/detach policies to/from roles

### Route 53
- Manage DNS records for SES verification

### CloudWatch Logs
- Create and manage log groups for SMS delivery tracking

---

## After Updating Permissions

Once you've updated the permissions, run:

```bash
cd /home/rabin/projects/pmo/infra-tf
terraform apply
```

This will create all the SES and SNS resources.

---

## Troubleshooting

### If you still get permission errors:

1. **Wait a few seconds** - IAM permissions can take a moment to propagate

2. **Verify the policy is attached**:
   ```bash
   aws iam list-attached-user-policies --user-name deployment-user
   ```

3. **Check for policy conflicts** - ensure no deny policies are blocking these permissions

4. **Try with a different profile** that has admin access

---

## Security Note

These permissions are broad (using `*` for resources) to allow Terraform to manage all SES/SNS resources. In a production environment with multiple teams, you may want to restrict these permissions to specific resources using ARN patterns.

For example, instead of:
```json
"Resource": "*"
```

You could use:
```json
"Resource": [
  "arn:aws:ses:us-east-1:ACCOUNT_ID:identity/cohuron.com",
  "arn:aws:sns:us-east-1:ACCOUNT_ID:topic/cohuron-*"
]
```
