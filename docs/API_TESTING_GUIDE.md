# API Testing Guide for James Miller

## Complete Step-by-Step Instructions for Error-Free API Testing

This guide ensures you **never get authentication errors** when testing API endpoints.

---

## 🎯 The Problem We're Solving

When testing APIs, you often see:
```json
{
  "error": "User not authenticated"
}
```

This happens because:
- JWT tokens expire after 24 hours
- Complex bash commands get mangled
- Tokens aren't cached properly

---

## ✅ The Complete Solution

### Step 1: Initial Setup (One-Time)

Create the authentication helper script:

```bash
# Navigate to your project
cd /home/rabin/projects/pmo

# Create the token fetcher script (already exists at /tmp/get-fresh-token.sh)
cat > /tmp/get-fresh-token.sh << 'EOF'
#!/bin/bash
# Get fresh JWT token for james.miller@huronhome.ca
curl -s -X POST "http://localhost:4000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "james.miller@huronhome.ca", "password": "password123"}' \
  | jq -r '.token' > /tmp/jwt_token.txt

cat /tmp/jwt_token.txt
EOF

chmod +x /tmp/get-fresh-token.sh
```

---

### Step 2: Ensure Services Are Running

Before any testing, make sure all services are up:

```bash
# Start all services (DB, API, Web)
/home/rabin/projects/pmo/tools/start-all.sh

# Wait for services to be ready (takes ~10 seconds)
sleep 10

# Verify API is running
curl -s http://localhost:4000/api/v1/health || echo "API not ready yet, wait 5 more seconds"
```

---

### Step 3: Get Fresh Authentication Token

**Do this ONCE per day** or whenever you start testing:

```bash
# Get fresh token and save to file
/tmp/get-fresh-token.sh

# Verify token was saved
echo "Token saved: $(wc -c < /tmp/jwt_token.txt) characters"
```

**Expected Output:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4MjYwYjFiMC01ZWZjLTQ2MTEtYWQzMy1lZTc2YzBjZjdmMTMiLCJlbWFpbCI6ImphbWVzLm1pbGxlckBodXJvbmhvbWUuY2EiLCJuYW1lIjoiSmFtZXMgTWlsbGVyIiwiaWF0IjoxNzU5NDExNjkwLCJleHAiOjE3NTk0OTgwOTB9.bO-s_7_gcSjyCy8NkUHyYZKzs04nvIACgiGmSf5eTj8
Token saved: 265 characters
```

---

### Step 4: Test Any API Endpoint

Now you can test **any** endpoint using the cached token:

#### Example 1: List Wiki Pages
```bash
curl -s -H "Authorization: Bearer $(cat /tmp/jwt_token.txt)" \
  "http://localhost:4000/api/v1/wiki" | jq '.'
```

#### Example 2: Get Specific Wiki Page
```bash
# Replace {wiki-id} with actual ID
curl -s -H "Authorization: Bearer $(cat /tmp/jwt_token.txt)" \
  "http://localhost:4000/api/v1/wiki/11111111-1111-1111-1111-111111111111" | jq '.'
```

#### Example 3: List Projects
```bash
curl -s -H "Authorization: Bearer $(cat /tmp/jwt_token.txt)" \
  "http://localhost:4000/api/v1/project" | jq '.'
```

#### Example 4: Search Wiki Pages
```bash
curl -s -H "Authorization: Bearer $(cat /tmp/jwt_token.txt)" \
  "http://localhost:4000/api/v1/wiki?search=landscaping" | jq '.'
```

#### Example 5: Get Project Tasks
```bash
# Replace {project-id} with actual ID
curl -s -H "Authorization: Bearer $(cat /tmp/jwt_token.txt)" \
  "http://localhost:4000/api/v1/project/84215ccb-313d-48f8-9c37-4398f28c0b1f/task" | jq '.'
```

---

## 🔧 Advanced Usage

### Creating Reusable Test Scripts

Create entity-specific test scripts:

**Test Wiki Endpoints:**
```bash
cat > /tmp/test-wiki.sh << 'EOF'
#!/bin/bash
TOKEN=$(cat /tmp/jwt_token.txt)

echo "=== Testing Wiki Endpoints ==="
echo ""

echo "1. List all wikis:"
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/v1/wiki" | jq '{total, count: (.data|length)}'
echo ""

echo "2. Get first wiki details:"
WIKI_ID=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/v1/wiki" | jq -r '.data[0].id')
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/v1/wiki/$WIKI_ID" | jq '{name, wiki_type, publication_status, summary}'
echo ""

echo "3. Search wikis:"
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/v1/wiki?search=safety" | jq '{results: (.data|length)}'
EOF

chmod +x /tmp/test-wiki.sh
```

**Test Project Endpoints:**
```bash
cat > /tmp/test-project.sh << 'EOF'
#!/bin/bash
TOKEN=$(cat /tmp/jwt_token.txt)

echo "=== Testing Project Endpoints ==="
echo ""

echo "1. List all projects:"
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/v1/project" | jq '{total, projects: [.data[] | {name, project_stage}]}'
echo ""

echo "2. Get project with tasks:"
PROJECT_ID=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/v1/project" | jq -r '.data[0].id')
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/v1/project/$PROJECT_ID/task" | jq '{tasks: (.data|length)}'
EOF

chmod +x /tmp/test-project.sh
```

---

## 🚨 Troubleshooting

### Problem: "User not authenticated"

**Solution:**
```bash
# Get fresh token
/tmp/get-fresh-token.sh

# Verify token file exists and has content
ls -lh /tmp/jwt_token.txt
cat /tmp/jwt_token.txt | wc -c  # Should show ~265 characters
```

### Problem: "Connection refused"

**Solution:**
```bash
# Check if API is running
curl http://localhost:4000/api/v1/health

# If not running, start services
/home/rabin/projects/pmo/tools/start-all.sh
sleep 10
```

### Problem: Empty response or "[]"

**Solution:**
```bash
# Check database has data
export PGPASSWORD=app
psql -h localhost -p 5434 -U app -d app -c "SELECT COUNT(*) FROM app.d_wiki;"

# If count is 0, reimport data
/home/rabin/projects/pmo/tools/db-import.sh
```

### Problem: Token expired after testing for hours

**Solution:**
```bash
# Tokens expire after 24 hours - just refresh
/tmp/get-fresh-token.sh

# Continue testing with new token
curl -s -H "Authorization: Bearer $(cat /tmp/jwt_token.txt)" \
  "http://localhost:4000/api/v1/wiki" | jq '.'
```

---

## 📋 Complete Testing Workflow

Here's the complete workflow you should follow **every time**:

```bash
# 1. Start services (if not already running)
/home/rabin/projects/pmo/tools/start-all.sh
sleep 10

# 2. Get fresh authentication token (once per day)
/tmp/get-fresh-token.sh

# 3. Test any endpoint you want
curl -s -H "Authorization: Bearer $(cat /tmp/jwt_token.txt)" \
  "http://localhost:4000/api/v1/wiki" | jq '.'

# 4. Test another endpoint (reuse same token)
curl -s -H "Authorization: Bearer $(cat /tmp/jwt_token.txt)" \
  "http://localhost:4000/api/v1/project" | jq '.'

# 5. Test another endpoint (still same token)
curl -s -H "Authorization: Bearer $(cat /tmp/jwt_token.txt)" \
  "http://localhost:4000/api/v1/employee" | jq '.'
```

---

## 🎯 Quick Reference Commands

### Authentication
```bash
# Get fresh token
/tmp/get-fresh-token.sh

# Check token
cat /tmp/jwt_token.txt
```

### Common Endpoints
```bash
# Token variable for easier copying
TOKEN=$(cat /tmp/jwt_token.txt)

# Wiki
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/v1/wiki | jq '.'

# Projects
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/v1/project | jq '.'

# Tasks
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/v1/task | jq '.'

# Employees
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/v1/employee | jq '.'

# Business Units
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/v1/biz | jq '.'

# Offices
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/v1/office | jq '.'

# Artifacts
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/v1/artifact | jq '.'

# Forms
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/v1/form | jq '.'
```

### Service Management
```bash
# Start all services
/home/rabin/projects/pmo/tools/start-all.sh

# Check service status
curl http://localhost:4000/api/v1/health  # API
curl http://localhost:5173                 # Web

# View logs
tail -f /home/rabin/projects/pmo/logs/api.log  # API logs
tail -f /home/rabin/projects/pmo/logs/web.log  # Web logs
```

---

## 💡 Pro Tips

### 1. Create an alias for quick token access
Add to your `~/.bashrc`:
```bash
alias get-token='/tmp/get-fresh-token.sh'
alias api-wiki='curl -s -H "Authorization: Bearer $(cat /tmp/jwt_token.txt)" http://localhost:4000/api/v1/wiki | jq'
alias api-project='curl -s -H "Authorization: Bearer $(cat /tmp/jwt_token.txt)" http://localhost:4000/api/v1/project | jq'
```

### 2. Use environment variable for cleaner commands
```bash
# Set once
export TOKEN=$(cat /tmp/jwt_token.txt)

# Use many times
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/v1/wiki | jq '.'
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/v1/project | jq '.'
```

### 3. Pretty print JSON responses
```bash
# Compact view
curl -s -H "Authorization: Bearer $(cat /tmp/jwt_token.txt)" \
  http://localhost:4000/api/v1/wiki | jq -c '.'

# Colored view
curl -s -H "Authorization: Bearer $(cat /tmp/jwt_token.txt)" \
  http://localhost:4000/api/v1/wiki | jq -C '.' | less -R
```

---

## 🎉 Summary

**The Golden Rule:**
1. ✅ Get token ONCE: `/tmp/get-fresh-token.sh`
2. ✅ Use cached token MANY times: `$(cat /tmp/jwt_token.txt)`
3. ✅ Refresh token DAILY or when expired

**Never do this:**
```bash
# ❌ DON'T: Complex nested commands
TOKEN=$(curl ... | jq .token) && curl -H "Authorization: Bearer $TOKEN" ...

# ❌ DON'T: Hardcoded expired tokens
export JWT_TOKEN='eyJhbGc...'
```

**Always do this:**
```bash
# ✅ DO: Simple file-based caching
/tmp/get-fresh-token.sh
curl -H "Authorization: Bearer $(cat /tmp/jwt_token.txt)" ...
```

---

## 📚 Additional Resources

- **API Documentation**: http://localhost:4000/docs
- **Database Schema**: `/home/rabin/projects/pmo/db/README.md`
- **Tool Scripts**: `/home/rabin/projects/pmo/tools/`
- **Test Scripts**: `/tmp/test-wiki-api.sh`, `/tmp/test-project.sh`

---

**Questions?** Run: `/tmp/test-wiki-api.sh` to see a complete working example!
