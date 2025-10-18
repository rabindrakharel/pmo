# ============================================================================
# VPC Module - Coherent PMO Platform
# ============================================================================
# Creates VPC with public (app) and private (data) subnets
# ============================================================================

data "aws_availability_zones" "available" {
  state = "available"
}

# Create VPC
resource "aws_vpc" "coherent_vpc" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(var.global_tags, {
    Name = var.vpc_name
  })
}

# Internet Gateway
resource "aws_internet_gateway" "coherent_igw" {
  vpc_id = aws_vpc.coherent_vpc.id

  tags = merge(var.global_tags, {
    Name = "${var.vpc_name}-igw"
  })
}

# ============================================================================
# Public Subnets (app-subnet-group)
# ============================================================================

resource "aws_subnet" "app_public_subnets" {
  count                   = length(var.availability_zones)
  vpc_id                  = aws_vpc.coherent_vpc.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = merge(var.global_tags, {
    Name = "${var.public_subnet_name}-${var.availability_zones[count.index]}"
    Type = "public"
  })
}

# Public Route Table
resource "aws_route_table" "public_rt" {
  vpc_id = aws_vpc.coherent_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.coherent_igw.id
  }

  tags = merge(var.global_tags, {
    Name = "${var.public_subnet_name}-rt"
  })
}

# Associate Public Subnets with Route Table
resource "aws_route_table_association" "public_rt_assoc" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.app_public_subnets[count.index].id
  route_table_id = aws_route_table.public_rt.id
}

# ============================================================================
# Private Subnets (data-subnet-group)
# ============================================================================

resource "aws_subnet" "data_private_subnets" {
  count                   = length(var.availability_zones)
  vpc_id                  = aws_vpc.coherent_vpc.id
  cidr_block              = var.private_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = false

  tags = merge(var.global_tags, {
    Name = "${var.private_subnet_name}-${var.availability_zones[count.index]}"
    Type = "private"
  })
}

# NAT Gateway (for private subnet outbound access)
resource "aws_eip" "nat_eip" {
  domain = "vpc"

  tags = merge(var.global_tags, {
    Name = "${var.vpc_name}-nat-eip"
  })
}

resource "aws_nat_gateway" "coherent_nat" {
  allocation_id = aws_eip.nat_eip.id
  subnet_id     = aws_subnet.app_public_subnets[0].id

  tags = merge(var.global_tags, {
    Name = "${var.vpc_name}-nat-gateway"
  })

  depends_on = [aws_internet_gateway.coherent_igw]
}

# Private Route Table
resource "aws_route_table" "private_rt" {
  vpc_id = aws_vpc.coherent_vpc.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.coherent_nat.id
  }

  tags = merge(var.global_tags, {
    Name = "${var.private_subnet_name}-rt"
  })
}

# Associate Private Subnets with Route Table
resource "aws_route_table_association" "private_rt_assoc" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.data_private_subnets[count.index].id
  route_table_id = aws_route_table.private_rt.id
}

# ============================================================================
# Security Groups
# ============================================================================

# App Security Group (for EC2)
resource "aws_security_group" "app_sg" {
  name        = "${var.vpc_name}-app-sg"
  description = "Security group for Coherent application server"
  vpc_id      = aws_vpc.coherent_vpc.id

  # SSH access
  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.ssh_allowed_cidr
  }

  # HTTP access
  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS access
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # API server (Fastify) - port 4000
  ingress {
    description = "API Server"
    from_port   = 4000
    to_port     = 4000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Web server (Vite) - port 5173
  ingress {
    description = "Web Server"
    from_port   = 5173
    to_port     = 5173
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Outbound traffic
  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.global_tags, {
    Name = "${var.vpc_name}-app-sg"
  })
}

# DB Security Group (for RDS)
resource "aws_security_group" "db_sg" {
  name        = "${var.vpc_name}-db-sg"
  description = "Security group for Coherent RDS PostgreSQL database"
  vpc_id      = aws_vpc.coherent_vpc.id

  # PostgreSQL access from app server only
  ingress {
    description     = "PostgreSQL from app server"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app_sg.id]
  }

  # Outbound traffic
  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.global_tags, {
    Name = "${var.vpc_name}-db-sg"
  })
}
