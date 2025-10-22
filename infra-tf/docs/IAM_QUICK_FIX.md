# ⚡ Quick Fix: Complete IAM Setup

## 🎯 What You Need to Do (5 Minutes)

### Step 1: Login to AWS Console as Admin
Go to: https://console.aws.amazon.com/iam/

### Step 2: Navigate to deployment-user
IAM → Users → **deployment-user**

### Step 3: Attach New Policy
1. Click **Permissions** tab
2. Click **Add permissions** → **Attach policies directly**
3. Search for: **cohuron-deployment-policy**
4. ✅ Check the box
5. Click **Add permissions**

### Step 4: Remove Old Policies (Click X next to each)
- ❌ AmazonSQSFullAccess
- ❌ AmazonDynamoDBFullAccess
- ❌ AmazonS3FullAccess
- ❌ AmazonBedrockFullAccess
- ❌ AWSLambda_FullAccess

### Step 5: Back to Terminal
```bash
cd /home/rabin/projects/pmo/infra-tf
terraform apply -auto-approve
./deploy-code.sh
```

---

## ✅ Result

One policy replaces 11 policies + adds EventBridge permissions!

**Policy ARN**: `arn:aws:iam::957207443425:policy/cohuron-deployment-policy`

---

## 📚 Full Documentation

See `COMPLETE_IAM_SETUP.md` for detailed instructions.
