# ============================================================================
# EC2 Module - Coherent PMO Platform
# ============================================================================
# Creates EC2 instance with IAM role, Elastic IP, and user data
# ============================================================================

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# ============================================================================
# IAM Role for EC2
# ============================================================================

resource "aws_iam_role" "ec2_role" {
  name = "${var.project_name}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-ec2-role"
  })
}

# Policy for S3 access
resource "aws_iam_role_policy" "ec2_s3_policy" {
  name = "${var.project_name}-ec2-s3-policy"
  role = aws_iam_role.ec2_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket",
          "s3:GetObjectVersion",
          "s3:DeleteObjectVersion",
          "s3:GetBucketLocation",
          "s3:GetBucketVersioning"
        ]
        Resource = concat(
          [
            var.s3_bucket_arn,
            "${var.s3_bucket_arn}/*",
            var.s3_code_bucket_arn,
            "${var.s3_code_bucket_arn}/*"
          ],
          var.s3_attachments_bucket_arn != "" ? [
            var.s3_attachments_bucket_arn,
            "${var.s3_attachments_bucket_arn}/*"
          ] : []
        )
      }
    ]
  })
}

# Attach SSM policy for Systems Manager access
resource "aws_iam_role_policy_attachment" "ec2_ssm_policy" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Instance profile
resource "aws_iam_instance_profile" "ec2_profile" {
  name = "${var.project_name}-ec2-profile"
  role = aws_iam_role.ec2_role.name

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-ec2-profile"
  })
}

# ============================================================================
# SSH Key Pair
# ============================================================================

resource "aws_key_pair" "coherent_key" {
  key_name   = "${var.project_name}-key"
  public_key = var.ec2_public_key

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-key"
  })
}

# ============================================================================
# EC2 Instance
# ============================================================================

resource "aws_instance" "app_server" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.ec2_instance_type
  subnet_id     = var.app_subnet_id

  vpc_security_group_ids = [var.app_security_group_id]
  iam_instance_profile   = aws_iam_instance_profile.ec2_profile.name
  key_name               = aws_key_pair.coherent_key.key_name

  root_block_device {
    volume_type = "gp3"
    volume_size = var.ec2_root_volume_size
    encrypted   = true
  }

  # Use base64 + gzip for user_data to handle large scripts (16KB+ limit)
  user_data_base64 = base64gzip(templatefile("${path.root}/${var.user_data_script}", {
    db_host         = var.db_host
    db_port         = var.db_port
    db_name         = var.db_name
    db_user         = var.db_user
    db_password     = var.db_password
    s3_bucket       = var.s3_bucket_name
    aws_region      = var.aws_region
    domain_name     = var.domain_name
    app_subdomain   = var.app_subdomain
    github_repo_url = var.github_repo_url
    project_name    = var.project_name
  }))

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-app-server"
  })
}

# ============================================================================
# Elastic IP
# ============================================================================

resource "aws_eip" "app_eip" {
  domain   = "vpc"
  instance = aws_instance.app_server.id

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-app-eip"
  })
}
