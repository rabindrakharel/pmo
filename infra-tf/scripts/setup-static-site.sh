#!/bin/bash
# ============================================================================
# Static Website Setup - rabindrakharel.com
# ============================================================================
# Creates directory structure and sets up static website
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}Static Website Setup - rabindrakharel.com${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}ERROR: This script must be run as root${NC}"
    echo "Run with: sudo $0"
    exit 1
fi

# Configuration
SITE_DIR="/var/www/rabindrakharel.com"
REPO_DIR="/opt/coherent/rabindrakharel.com"
NGINX_USER="www-data"

echo -e "${YELLOW}Configuration:${NC}"
echo "  Site directory: $SITE_DIR"
echo "  Source repository: $REPO_DIR"
echo "  Nginx user: $NGINX_USER"
echo ""

# ============================================================================
# Step 1: Create website directory
# ============================================================================

echo -e "${YELLOW}Step 1: Creating website directory...${NC}"

mkdir -p $SITE_DIR
chown -R $NGINX_USER:$NGINX_USER $SITE_DIR
chmod -R 755 $SITE_DIR

echo -e "${GREEN}✓ Website directory created: $SITE_DIR${NC}"
echo ""

# ============================================================================
# Step 2: Create default index page
# ============================================================================

echo -e "${YELLOW}Step 2: Creating default index page...${NC}"

cat > $SITE_DIR/index.html <<'INDEX_HTML'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rabindra Kharel - Documentation & Resources</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .container {
            max-width: 800px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            padding: 40px;
            animation: fadeIn 0.5s ease-in;
        }

        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        h1 {
            color: #667eea;
            margin-bottom: 10px;
            font-size: 2.5em;
        }

        h2 {
            color: #764ba2;
            margin-top: 30px;
            margin-bottom: 15px;
            font-size: 1.5em;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }

        p {
            margin-bottom: 15px;
            color: #555;
        }

        .subtitle {
            color: #666;
            font-size: 1.1em;
            margin-bottom: 30px;
        }

        .section {
            margin-top: 30px;
        }

        .file-list {
            list-style: none;
            margin-top: 15px;
        }

        .file-list li {
            padding: 12px;
            margin-bottom: 8px;
            background: #f8f9fa;
            border-left: 4px solid #667eea;
            border-radius: 4px;
            transition: all 0.3s ease;
        }

        .file-list li:hover {
            background: #e9ecef;
            transform: translateX(5px);
        }

        .file-list a {
            color: #667eea;
            text-decoration: none;
            font-weight: 500;
        }

        .file-list a:hover {
            color: #764ba2;
        }

        .badge {
            display: inline-block;
            padding: 4px 12px;
            background: #667eea;
            color: white;
            border-radius: 12px;
            font-size: 0.85em;
            margin-left: 10px;
        }

        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #888;
            font-size: 0.9em;
        }

        .status {
            display: inline-block;
            padding: 6px 12px;
            background: #28a745;
            color: white;
            border-radius: 4px;
            font-size: 0.9em;
            margin-bottom: 20px;
        }

        code {
            background: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            color: #e83e8c;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="status">🟢 Site Active</div>
        <h1>Rabindra Kharel</h1>
        <p class="subtitle">Documentation, Resources & Technical Notes</p>

        <div class="section">
            <h2>Welcome</h2>
            <p>
                This site hosts technical documentation, README files, and various resources.
                Browse the directory listing below or navigate directly to specific files.
            </p>
        </div>

        <div class="section">
            <h2>Available Resources</h2>
            <ul class="file-list">
                <li>
                    <a href="/README.md">📄 README.md</a>
                    <span class="badge">Markdown</span>
                </li>
                <li>
                    <a href="/">📁 Browse All Files</a>
                    <span class="badge">Directory</span>
                </li>
            </ul>
        </div>

        <div class="section">
            <h2>Quick Links</h2>
            <ul class="file-list">
                <li><a href="https://cohuron.com">🏢 Cohuron PMO Platform</a></li>
                <li><a href="https://github.com">🐙 GitHub</a></li>
            </ul>
        </div>

        <div class="section">
            <h2>Technical Details</h2>
            <p>
                This is a static website served via nginx on AWS EC2. SSL certificates are
                managed by Let's Encrypt with automatic renewal via Lambda.
            </p>
            <p>
                <strong>Stack:</strong> nginx, Let's Encrypt, AWS EC2, AWS Lambda
            </p>
        </div>

        <div class="footer">
            <p>&copy; 2025 Rabindra Kharel | Powered by AWS & nginx</p>
            <p>Last updated: <span id="date"></span></p>
        </div>
    </div>

    <script>
        document.getElementById('date').textContent = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    </script>
</body>
</html>
INDEX_HTML

chown $NGINX_USER:$NGINX_USER $SITE_DIR/index.html
chmod 644 $SITE_DIR/index.html

echo -e "${GREEN}✓ Default index page created${NC}"
echo ""

# ============================================================================
# Step 3: Create sample README
# ============================================================================

echo -e "${YELLOW}Step 3: Creating sample README...${NC}"

cat > $SITE_DIR/README.md <<'README_MD'
# Rabindra Kharel - Documentation Site

Welcome to my documentation and resources site.

## About

This site hosts various technical documentation, README files, and resources.

## Content Structure

- `/` - Home page with directory listing
- `/README.md` - This file
- Additional markdown files and documentation

## Technical Stack

- **Web Server:** nginx
- **SSL:** Let's Encrypt (auto-renewal via Lambda)
- **Hosting:** AWS EC2
- **Domain:** rabindrakharel.com (managed by DreamHost)

## Deployment

Content is deployed via rsync or direct file placement in `/var/www/rabindrakharel.com`.

```bash
# Deploy files
rsync -avz ./content/ ubuntu@ec2-ip:/var/www/rabindrakharel.com/
```

## SSL Certificate Management

SSL certificates are automatically renewed by a Lambda function that triggers
monthly renewals via AWS Systems Manager.

---

Last updated: 2025-10-27
README_MD

chown $NGINX_USER:$NGINX_USER $SITE_DIR/README.md
chmod 644 $SITE_DIR/README.md

echo -e "${GREEN}✓ Sample README created${NC}"
echo ""

# ============================================================================
# Step 4: Create 404 error page
# ============================================================================

echo -e "${YELLOW}Step 4: Creating error pages...${NC}"

cat > $SITE_DIR/404.html <<'ERROR_HTML'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>404 - Page Not Found</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            text-align: center;
            background: white;
            padding: 60px 40px;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        h1 {
            font-size: 6em;
            margin: 0;
            color: #667eea;
        }
        h2 {
            font-size: 1.5em;
            margin: 20px 0;
            color: #764ba2;
        }
        p {
            color: #666;
            margin-bottom: 30px;
        }
        a {
            display: inline-block;
            padding: 12px 30px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            transition: background 0.3s ease;
        }
        a:hover {
            background: #764ba2;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>404</h1>
        <h2>Page Not Found</h2>
        <p>The page you're looking for doesn't exist.</p>
        <a href="/">Go Home</a>
    </div>
</body>
</html>
ERROR_HTML

cat > $SITE_DIR/50x.html <<'ERROR50X_HTML'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>500 - Server Error</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            text-align: center;
            background: white;
            padding: 60px 40px;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        h1 {
            font-size: 6em;
            margin: 0;
            color: #dc3545;
        }
        h2 {
            font-size: 1.5em;
            margin: 20px 0;
            color: #764ba2;
        }
        p {
            color: #666;
            margin-bottom: 30px;
        }
        a {
            display: inline-block;
            padding: 12px 30px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            transition: background 0.3s ease;
        }
        a:hover {
            background: #764ba2;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>500</h1>
        <h2>Server Error</h2>
        <p>Something went wrong on our end. Please try again later.</p>
        <a href="/">Go Home</a>
    </div>
</body>
</html>
ERROR50X_HTML

chown $NGINX_USER:$NGINX_USER $SITE_DIR/404.html $SITE_DIR/50x.html
chmod 644 $SITE_DIR/404.html $SITE_DIR/50x.html

echo -e "${GREEN}✓ Error pages created${NC}"
echo ""

# ============================================================================
# Step 5: Create deployment helper script
# ============================================================================

echo -e "${YELLOW}Step 5: Creating deployment helper script...${NC}"

cat > /usr/local/bin/deploy-rabindrakharel <<'DEPLOY_SCRIPT'
#!/bin/bash
# ============================================================================
# Deployment Script - rabindrakharel.com
# ============================================================================
# Syncs content from repository to web root
# ============================================================================

set -e

REPO_DIR="/opt/coherent/rabindrakharel.com"
SITE_DIR="/var/www/rabindrakharel.com"
NGINX_USER="www-data"

echo "============================================"
echo "Deploying rabindrakharel.com"
echo "Started at: $(date)"
echo "============================================"

# Check if source directory exists
if [ ! -d "$REPO_DIR" ]; then
    echo "ERROR: Source directory not found: $REPO_DIR"
    echo "Please create the directory and add content:"
    echo "  sudo mkdir -p $REPO_DIR"
    echo "  sudo chown ubuntu:ubuntu $REPO_DIR"
    exit 1
fi

# Sync files (excluding hidden files)
echo "Syncing files from $REPO_DIR to $SITE_DIR..."
rsync -av --delete \
    --exclude='.*' \
    --exclude='*.swp' \
    --exclude='*~' \
    "$REPO_DIR/" "$SITE_DIR/"

# Fix permissions
echo "Setting permissions..."
chown -R $NGINX_USER:$NGINX_USER $SITE_DIR
find $SITE_DIR -type f -exec chmod 644 {} \;
find $SITE_DIR -type d -exec chmod 755 {} \;

echo "✓ Deployment completed successfully"
echo "Completed at: $(date)"
DEPLOY_SCRIPT

chmod +x /usr/local/bin/deploy-rabindrakharel
chown root:root /usr/local/bin/deploy-rabindrakharel

echo -e "${GREEN}✓ Deployment script created: /usr/local/bin/deploy-rabindrakharel${NC}"
echo ""

# ============================================================================
# Step 6: Create content repository directory
# ============================================================================

echo -e "${YELLOW}Step 6: Creating content repository directory...${NC}"

mkdir -p $REPO_DIR
chown ubuntu:ubuntu $REPO_DIR
chmod 755 $REPO_DIR

echo -e "${GREEN}✓ Content repository created: $REPO_DIR${NC}"
echo ""

# ============================================================================
# Summary
# ============================================================================

echo -e "${GREEN}============================================================================${NC}"
echo -e "${GREEN}Static Website Setup Completed!${NC}"
echo -e "${GREEN}============================================================================${NC}"
echo ""
echo -e "${BLUE}Website Information:${NC}"
echo "  Domain: rabindrakharel.com"
echo "  Web root: $SITE_DIR"
echo "  Content repo: $REPO_DIR"
echo "  Nginx user: $NGINX_USER"
echo ""
echo -e "${BLUE}Files Created:${NC}"
echo "  ✓ $SITE_DIR/index.html (homepage)"
echo "  ✓ $SITE_DIR/README.md (documentation)"
echo "  ✓ $SITE_DIR/404.html (error page)"
echo "  ✓ $SITE_DIR/50x.html (error page)"
echo "  ✓ /usr/local/bin/deploy-rabindrakharel (deployment script)"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Add content to: $REPO_DIR"
echo "     sudo mkdir -p $REPO_DIR"
echo "     sudo chown ubuntu:ubuntu $REPO_DIR"
echo "     # Add your README files and content"
echo ""
echo "  2. Deploy content:"
echo "     sudo /usr/local/bin/deploy-rabindrakharel"
echo ""
echo "  3. Test locally:"
echo "     curl http://localhost/"
echo ""
echo "  4. After SSL setup, test online:"
echo "     curl https://rabindrakharel.com"
echo ""
echo -e "${YELLOW}Deployment Commands:${NC}"
echo "  • Deploy content: sudo /usr/local/bin/deploy-rabindrakharel"
echo "  • Check site: ls -la $SITE_DIR"
echo "  • View nginx logs: tail -f /var/log/nginx/access.log"
echo ""
echo -e "${GREEN}✓ Setup completed at: $(date)${NC}"
echo -e "${GREEN}============================================================================${NC}"
