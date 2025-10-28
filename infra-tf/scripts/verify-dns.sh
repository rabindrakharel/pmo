#!/bin/bash
# ============================================================================
# DNS Verification Script
# ============================================================================
# Verifies DNS configuration for cohuron.com and rabindrakharel.com
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}DNS Verification for Multi-Domain Setup${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# Get EC2 IP from Terraform
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$(dirname "$SCRIPT_DIR")"

cd "$TERRAFORM_DIR"

if [ -f "terraform.tfstate" ]; then
    EC2_IP=$(terraform output -raw ec2_public_ip 2>/dev/null || echo "")
else
    EC2_IP=""
fi

if [ -z "$EC2_IP" ]; then
    echo -e "${YELLOW}Warning: Could not get EC2 IP from Terraform${NC}"
    echo -e "${YELLOW}Please run 'terraform apply' first or enter IP manually${NC}"
    echo ""
    read -p "Enter EC2 Public IP: " EC2_IP
fi

echo -e "${GREEN}Expected IP: $EC2_IP${NC}"
echo ""

# Function to check DNS
check_dns() {
    local domain=$1
    echo -e "${BLUE}Checking $domain...${NC}"

    # Root domain
    echo -n "  $domain: "
    result=$(dig +short $domain A | head -1)
    if [ -z "$result" ]; then
        echo -e "${RED}❌ No A record found${NC}"
        return 1
    elif [ "$result" == "$EC2_IP" ]; then
        echo -e "${GREEN}✅ $result${NC}"
    else
        echo -e "${RED}❌ $result${NC} (expected: ${YELLOW}$EC2_IP${NC})"
        return 1
    fi

    # WWW subdomain
    echo -n "  www.$domain: "
    result=$(dig +short www.$domain A | head -1)
    if [ -z "$result" ]; then
        echo -e "${RED}❌ No A record found${NC}"
        return 1
    elif [ "$result" == "$EC2_IP" ]; then
        echo -e "${GREEN}✅ $result${NC}"
    else
        echo -e "${RED}❌ $result${NC} (expected: ${YELLOW}$EC2_IP${NC})"
        return 1
    fi

    echo ""
    return 0
}

# Function to test HTTP access
test_http() {
    local domain=$1
    echo -n "  http://$domain: "

    status=$(curl -s -o /dev/null -w "%{http_code}" -m 5 http://$domain 2>/dev/null || echo "000")

    if [ "$status" == "200" ] || [ "$status" == "301" ] || [ "$status" == "302" ]; then
        echo -e "${GREEN}✅ HTTP $status${NC}"
        return 0
    elif [ "$status" == "000" ]; then
        echo -e "${RED}❌ Connection failed${NC}"
        return 1
    else
        echo -e "${YELLOW}⚠️  HTTP $status${NC}"
        return 1
    fi
}

# Check DNS for both domains
all_passed=true

check_dns "cohuron.com" || all_passed=false
check_dns "rabindrakharel.com" || all_passed=false

# Test HTTP access
echo -e "${BLUE}Testing HTTP access...${NC}"
test_http "cohuron.com" || all_passed=false
test_http "rabindrakharel.com" || all_passed=false
echo ""

# Check with multiple DNS servers
echo -e "${BLUE}Testing with different DNS servers...${NC}"
for server in "8.8.8.8:Google" "1.1.1.1:Cloudflare" "208.67.222.222:OpenDNS"; do
    dns_ip=$(echo $server | cut -d: -f1)
    dns_name=$(echo $server | cut -d: -f2)

    echo -n "  $dns_name DNS - cohuron.com: "
    result=$(dig @$dns_ip +short cohuron.com A | head -1)
    if [ "$result" == "$EC2_IP" ]; then
        echo -e "${GREEN}✅${NC}"
    else
        echo -e "${RED}❌ $result${NC}"
    fi

    echo -n "  $dns_name DNS - rabindrakharel.com: "
    result=$(dig @$dns_ip +short rabindrakharel.com A | head -1)
    if [ "$result" == "$EC2_IP" ]; then
        echo -e "${GREEN}✅${NC}"
    else
        echo -e "${RED}❌ $result${NC}"
    fi
done
echo ""

# Summary
echo -e "${BLUE}============================================================================${NC}"
if [ "$all_passed" = true ]; then
    echo -e "${GREEN}✅ All DNS checks passed!${NC}"
    echo ""
    echo -e "${GREEN}Your domains are correctly configured and ready for SSL setup.${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "  1. SSH into EC2: ssh ubuntu@$EC2_IP"
    echo "  2. Run SSL setup: sudo bash /opt/coherent/pmo/infra-tf/scripts/setup-ssl.sh"
    echo ""
    echo -e "${BLUE}Test your domains:${NC}"
    echo "  • http://cohuron.com"
    echo "  • http://rabindrakharel.com"
else
    echo -e "${RED}❌ Some DNS checks failed${NC}"
    echo ""
    echo -e "${YELLOW}Troubleshooting steps:${NC}"
    echo "  1. Verify DNS records at your DNS provider"
    echo "  2. Wait for DNS propagation (can take up to 24 hours)"
    echo "  3. Check online: https://dnschecker.org/"
    echo "  4. Clear local DNS cache: sudo systemd-resolve --flush-caches"
    echo ""
    echo -e "${YELLOW}Expected DNS configuration:${NC}"
    echo "  Type    Name    Value"
    echo "  ────────────────────────────────"
    echo "  A       @       $EC2_IP"
    echo "  A       www     $EC2_IP"
    echo ""
    echo -e "${RED}Do NOT proceed with SSL setup until all checks pass!${NC}"
fi
echo -e "${BLUE}============================================================================${NC}"

# Exit with appropriate code
if [ "$all_passed" = true ]; then
    exit 0
else
    exit 1
fi
