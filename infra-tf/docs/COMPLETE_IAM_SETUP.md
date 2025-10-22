# Complete IAM Setup for Deployment User

## Current Situation

We successfully created a comprehensive IAM policy named **`cohuron-deployment-policy`** that includes all necessary permissions for Cohuron infrastructure deployment.

**However**, after detaching some old policies, the `deployment-user` lost IAM self-management permissions and cannot attach the new policy.

**Policy ARN**: `arn:aws:iam::957207443425:policy/cohuron-deployment-policy`

---

## ✅ What Was Done

1. ✅ Created comprehensive IAM policy: `cohuron-deployment-policy`
2. ✅ Detached 6 old AWS managed policies:
   - AmazonRoute53FullAccess
   - AmazonRedshiftFullAccess
   - AmazonSSMFullAccess
   - AmazonEC2FullAccess
   - AmazonRDSFullAccess
   - IAMFullAccess
3. ❌ Cannot complete due to lost IAM permissions

---

## 🔧 Complete This Setup in AWS Console

### Step 1: Log into AWS Console as Admin

1. Go to https://console.aws.amazon.com/
2. Log in with your **root account** or an **admin user** (NOT deployment-user)
3. Navigate to **IAM** → **Users** → **deployment-user**

### Step 2: Attach the New Comprehensive Policy

1. Click on **deployment-user**
2. Go to **Permissions** tab
3. Click **Add permissions** → **Attach policies directly**
4. In the search box, type: **cohuron-deployment-policy**
5. ✅ Check the box next to `cohuron-deployment-policy`
6. Click **Add permissions**

### Step 3: Remove Remaining Old Policies

Currently attached (need to remove):
- ✅ AmazonRoute53FullAccess (already removed)
- ✅ AmazonRedshiftFullAccess (already removed)
- ✅ AmazonSSMFullAccess (already removed)
- ✅ AmazonEC2FullAccess (already removed)
- ✅ AmazonRDSFullAccess (already removed)
- ✅ IAMFullAccess (already removed)
- ❌ AmazonSQSFullAccess (still attached - remove)
- ❌ AmazonDynamoDBFullAccess (still attached - remove)
- ❌ AmazonS3FullAccess (still attached - remove)
- ❌ AmazonBedrockFullAccess (still attached - remove)
- ❌ AWSLambda_FullAccess (still attached - remove)

For each policy to remove:
1. Click the **X** next to the policy name
2. Confirm removal

### Step 4: Verify Final Configuration

After completion, `deployment-user` should have **ONLY ONE** policy attached:
- ✅ `cohuron-deployment-policy`

This single policy provides ALL necessary permissions:
- EC2 Full Access
- S3 Full Access
- RDS Full Access
- Lambda Full Access
- **EventBridge Full Access** (NEW - needed for deployment automation)
- CloudWatch Full Access (NEW)
- Route53 Full Access
- SSM Full Access
- IAM Management
- VPC Full Access
- ELB, Auto Scaling, CloudFront
- WAF, SNS, SQS, KMS
- Secrets Manager, ACM
- And more...

---

## 🚀 After Setup - Complete Deployment Automation

Once the IAM policy is attached, return to your terminal and run:

```bash
cd /home/rabin/projects/pmo/infra-tf

# Complete the deployment infrastructure
terraform apply -auto-approve

# Test deployment automation
./deploy-code.sh
```

This will:
1. ✅ Create EventBridge rule (now has permission)
2. ✅ Create EventBridge target
3. ✅ Create Lambda permission
4. ✅ Enable automatic code deployment

---

## 📋 What the Comprehensive Policy Includes

The `cohuron-deployment-policy` provides full access to:

| Service Category | Permissions |
|-----------------|-------------|
| **Compute** | EC2, Lambda, Auto Scaling |
| **Storage** | S3, EBS, Backup |
| **Database** | RDS, ElastiCache |
| **Networking** | VPC, Route53, ELB, CloudFront |
| **Security** | IAM, WAF, ACM, Secrets Manager, KMS |
| **Monitoring** | CloudWatch, CloudWatch Logs, EventBridge |
| **Management** | SSM, Systems Manager |
| **Messaging** | SNS, SQS |

**Total Services**: 20+ AWS services

---

## 🎯 Simplified Comparison

### Before (11 Policies - Exceeded Quota)
```
✗ AmazonEC2FullAccess
✗ AmazonS3FullAccess
✗ AmazonRDSFullAccess
✗ AmazonRoute53FullAccess
✗ AmazonSSMFullAccess
✗ IAMFullAccess
✗ AWSLambda_FullAccess
✗ AmazonSQSFullAccess
✗ AmazonDynamoDBFullAccess
✗ AmazonBedrockFullAccess
✗ AmazonRedshiftFullAccess
```

### After (1 Policy - Within Quota)
```
✓ cohuron-deployment-policy (includes ALL above + MORE)
```

---

## 📞 Alternative: AWS CLI Method (If You Have Admin Credentials)

If you have AWS CLI credentials for an admin user, you can complete this via terminal:

```bash
# Attach the new policy
aws iam attach-user-policy \
  --user-name deployment-user \
  --policy-arn arn:aws:iam::957207443425:policy/cohuron-deployment-policy

# Remove old policies
aws iam detach-user-policy --user-name deployment-user --policy-arn arn:aws:iam::aws:policy/AmazonSQSFullAccess
aws iam detach-user-policy --user-name deployment-user --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess
aws iam detach-user-policy --user-name deployment-user --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
aws iam detach-user-policy --user-name deployment-user --policy-arn arn:aws:iam::aws:policy/AmazonBedrockFullAccess
aws iam detach-user-policy --user-name deployment-user --policy-arn arn:aws:iam::aws:policy/AWSLambda_FullAccess

# Verify
aws iam list-attached-user-policies --user-name deployment-user
```

---

## 🔍 Verification

After completing the setup, verify with:

```bash
# Check current policies
aws --profile cohuron iam list-attached-user-policies --user-name deployment-user

# Should show only:
# - cohuron-deployment-policy
```

---

## ✅ Success Criteria

You'll know the setup is complete when:
1. ✅ Only `cohuron-deployment-policy` is attached to deployment-user
2. ✅ `terraform apply` completes without IAM errors
3. ✅ EventBridge rule is created successfully
4. ✅ `./deploy-code.sh` uploads code and triggers deployment

---

## 📝 Policy Location

The policy document is saved at:
```
/home/rabin/projects/pmo/infra-tf/cohuron-deployment-policy.json
```

If you need to update or recreate it, the file is version-controlled and ready to use.

---

## 🎉 Next Steps After IAM Setup

1. **Attach policy in AWS Console** (5 minutes)
2. **Remove old policies** (2 minutes)
3. **Run terraform apply** (3 minutes)
4. **Test deployment** (5 minutes)
5. **Deploy your application** with `./deploy-code.sh` 🚀

Total time: ~15 minutes to complete full deployment automation!
