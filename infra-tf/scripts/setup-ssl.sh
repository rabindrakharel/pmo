#!/bin/bash
# ============================================================================
# SSL Setup Script - Let's Encrypt for Multiple Domains
# ============================================================================
# Sets up SSL certificates for cohuron.com and rabindrakharel.com
# Uses certbot with nginx plugin
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}SSL Setup - Let's Encrypt${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}ERROR: This script must be run as root${NC}"
    echo "Run with: sudo $0"
    exit 1
fi

# Configuration
DOMAINS=(
    "cohuron.com"
    "rabindrakharel.com"
)
EMAIL="admin@cohuron.com"  # Change this to your email
CERTBOT_DIR="/etc/letsencrypt"
WEBROOT_DIR="/var/www/certbot"
NGINX_CONFIG_DIR="/etc/nginx/sites-available"
NGINX_ENABLED_DIR="/etc/nginx/sites-enabled"

echo -e "${YELLOW}Configuration:${NC}"
echo "  Email: $EMAIL"
echo "  Domains: ${DOMAINS[@]}"
echo "  Webroot: $WEBROOT_DIR"
echo ""

# ============================================================================
# Step 1: Install certbot
# ============================================================================

echo -e "${YELLOW}Step 1: Installing certbot...${NC}"

if command -v certbot &> /dev/null; then
    echo -e "${GREEN}✓ Certbot already installed${NC}"
    certbot --version
else
    apt-get update -y
    apt-get install -y certbot python3-certbot-nginx
    echo -e "${GREEN}✓ Certbot installed successfully${NC}"
fi

echo ""

# ============================================================================
# Step 2: Create webroot directory for ACME challenges
# ============================================================================

echo -e "${YELLOW}Step 2: Creating webroot directory...${NC}"

mkdir -p $WEBROOT_DIR
chown -R www-data:www-data $WEBROOT_DIR
chmod -R 755 $WEBROOT_DIR

echo -e "${GREEN}✓ Webroot directory created: $WEBROOT_DIR${NC}"
echo ""

# ============================================================================
# Step 3: Deploy nginx configurations (HTTP only for initial setup)
# ============================================================================

echo -e "${YELLOW}Step 3: Deploying nginx configurations...${NC}"

# Create temporary HTTP-only configs for initial certificate acquisition
for domain in "${DOMAINS[@]}"; do
    echo "  Configuring $domain..."

    # Create temporary HTTP config for ACME challenge
    cat > "$NGINX_CONFIG_DIR/$domain-temp" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $domain www.$domain;

    location /.well-known/acme-challenge/ {
        root $WEBROOT_DIR;
    }

    location / {
        return 200 "SSL setup in progress...\n";
        add_header Content-Type text/plain;
    }
}
EOF

    # Enable the temporary config
    ln -sf "$NGINX_CONFIG_DIR/$domain-temp" "$NGINX_ENABLED_DIR/$domain-temp"
done

# Remove default nginx site
rm -f "$NGINX_ENABLED_DIR/default"

# Test nginx configuration
echo -e "${YELLOW}Testing nginx configuration...${NC}"
nginx -t

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Nginx configuration valid${NC}"
    systemctl reload nginx
    echo -e "${GREEN}✓ Nginx reloaded${NC}"
else
    echo -e "${RED}ERROR: Nginx configuration test failed${NC}"
    exit 1
fi

echo ""

# ============================================================================
# Step 4: Obtain SSL certificates
# ============================================================================

echo -e "${YELLOW}Step 4: Obtaining SSL certificates...${NC}"
echo -e "${YELLOW}This may take a few minutes...${NC}"
echo ""

for domain in "${DOMAINS[@]}"; do
    echo -e "${BLUE}Obtaining certificate for $domain...${NC}"

    # Check if certificate already exists
    if [ -d "$CERTBOT_DIR/live/$domain" ]; then
        echo -e "${YELLOW}Certificate already exists for $domain${NC}"
        echo -e "${YELLOW}Renewing certificate...${NC}"

        certbot renew --cert-name $domain --nginx --non-interactive
    else
        # Obtain new certificate
        certbot certonly \
            --webroot \
            --webroot-path=$WEBROOT_DIR \
            --email $EMAIL \
            --agree-tos \
            --no-eff-email \
            --non-interactive \
            -d $domain \
            -d www.$domain
    fi

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Certificate obtained for $domain${NC}"
    else
        echo -e "${RED}ERROR: Failed to obtain certificate for $domain${NC}"
        echo -e "${YELLOW}Make sure DNS is pointing to this server!${NC}"
        exit 1
    fi

    echo ""
done

# ============================================================================
# Step 5: Deploy production nginx configurations with SSL
# ============================================================================

echo -e "${YELLOW}Step 5: Deploying production nginx configurations...${NC}"

# Copy production configs from repository
REPO_NGINX_DIR="/opt/coherent/pmo/infra-tf/nginx-configs"

if [ -d "$REPO_NGINX_DIR" ]; then
    for domain in "${DOMAINS[@]}"; do
        if [ -f "$REPO_NGINX_DIR/$domain.conf" ]; then
            echo "  Deploying $domain configuration..."
            cp "$REPO_NGINX_DIR/$domain.conf" "$NGINX_CONFIG_DIR/$domain"

            # Enable the production config
            ln -sf "$NGINX_CONFIG_DIR/$domain" "$NGINX_ENABLED_DIR/$domain"

            # Remove temporary config
            rm -f "$NGINX_ENABLED_DIR/$domain-temp"
            rm -f "$NGINX_CONFIG_DIR/$domain-temp"
        else
            echo -e "${YELLOW}Warning: Configuration not found for $domain${NC}"
        fi
    done
else
    echo -e "${RED}ERROR: Nginx configs directory not found: $REPO_NGINX_DIR${NC}"
    echo -e "${YELLOW}Please ensure the repository is cloned to /opt/coherent/pmo${NC}"
    exit 1
fi

# Test nginx configuration
echo -e "${YELLOW}Testing nginx configuration...${NC}"
nginx -t

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Nginx configuration valid${NC}"
    systemctl reload nginx
    echo -e "${GREEN}✓ Nginx reloaded${NC}"
else
    echo -e "${RED}ERROR: Nginx configuration test failed${NC}"
    exit 1
fi

echo ""

# ============================================================================
# Step 6: Set up automatic renewal
# ============================================================================

echo -e "${YELLOW}Step 6: Setting up automatic renewal...${NC}"

# Certbot automatically creates a systemd timer for renewal
# Verify it's enabled
systemctl enable certbot.timer
systemctl start certbot.timer

# Check timer status
if systemctl is-enabled certbot.timer &> /dev/null; then
    echo -e "${GREEN}✓ Certbot renewal timer enabled${NC}"
    echo "  Certificates will be automatically renewed before expiry"
else
    echo -e "${YELLOW}Warning: Certbot timer not enabled${NC}"
fi

echo ""

# ============================================================================
# Step 7: Create manual renewal script
# ============================================================================

echo -e "${YELLOW}Step 7: Creating manual renewal script...${NC}"

cat > /usr/local/bin/renew-ssl-certificates <<'RENEWAL_SCRIPT'
#!/bin/bash
# ============================================================================
# SSL Certificate Renewal Script
# ============================================================================
# This script can be called by Lambda or manually to renew certificates
# ============================================================================

set -e

echo "============================================"
echo "SSL Certificate Renewal"
echo "Started at: $(date)"
echo "============================================"

# Renew certificates
certbot renew --quiet --nginx --non-interactive

# Reload nginx if renewal occurred
if [ $? -eq 0 ]; then
    echo "Checking if nginx reload is needed..."
    nginx -t && systemctl reload nginx
    echo "✓ Certificate renewal completed successfully"
else
    echo "ERROR: Certificate renewal failed"
    exit 1
fi

echo "Completed at: $(date)"
RENEWAL_SCRIPT

chmod +x /usr/local/bin/renew-ssl-certificates
chown root:root /usr/local/bin/renew-ssl-certificates

echo -e "${GREEN}✓ Renewal script created: /usr/local/bin/renew-ssl-certificates${NC}"
echo ""

# ============================================================================
# Step 8: Verify certificates
# ============================================================================

echo -e "${YELLOW}Step 8: Verifying certificates...${NC}"

for domain in "${DOMAINS[@]}"; do
    echo -e "${BLUE}Certificate for $domain:${NC}"

    if [ -d "$CERTBOT_DIR/live/$domain" ]; then
        certbot certificates --cert-name $domain | grep -E "(Certificate Name|Domains|Expiry Date)"
        echo ""
    else
        echo -e "${RED}Certificate not found for $domain${NC}"
    fi
done

# ============================================================================
# Summary
# ============================================================================

echo -e "${GREEN}============================================================================${NC}"
echo -e "${GREEN}SSL Setup Completed Successfully!${NC}"
echo -e "${GREEN}============================================================================${NC}"
echo ""
echo -e "${BLUE}Configured Domains:${NC}"
for domain in "${DOMAINS[@]}"; do
    echo "  ✓ https://$domain"
    echo "  ✓ https://www.$domain"
done
echo ""
echo -e "${BLUE}Certificate Information:${NC}"
echo "  Location: $CERTBOT_DIR/live/"
echo "  Renewal: Automatic via systemd timer (certbot.timer)"
echo "  Manual renewal: sudo /usr/local/bin/renew-ssl-certificates"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Verify DNS records point to this server"
echo "  2. Test HTTPS access: curl -I https://cohuron.com"
echo "  3. Test HTTPS access: curl -I https://rabindrakharel.com"
echo "  4. Deploy Lambda function for remote renewal triggering"
echo ""
echo -e "${YELLOW}Important Notes:${NC}"
echo "  • Certificates auto-renew every 60 days (30 days before expiry)"
echo "  • Monitor renewal logs: journalctl -u certbot.timer"
echo "  • Check certificate status: certbot certificates"
echo ""
echo -e "${GREEN}✓ Setup completed at: $(date)${NC}"
echo -e "${GREEN}============================================================================${NC}"
