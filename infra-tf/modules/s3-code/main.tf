# ============================================================================
# S3 Code Bucket Module - For Application Code Deployment
# ============================================================================

data "aws_caller_identity" "current" {}

# Generate random suffix for globally unique bucket name
resource "random_string" "bucket_suffix" {
  length  = 8
  special = false
  upper   = false
}

# S3 Bucket for Code
resource "aws_s3_bucket" "code" {
  bucket = "${var.project_name}-code-${random_string.bucket_suffix.result}"

  tags = merge(var.global_tags, {
    Name    = "${var.project_name}-code-bucket"
    Purpose = "Application Code Deployment"
  })
}

# Block public access
resource "aws_s3_bucket_public_access_block" "code_public_access" {
  bucket = aws_s3_bucket.code.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable versioning for code history
resource "aws_s3_bucket_versioning" "code_versioning" {
  bucket = aws_s3_bucket.code.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Enable encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "code_encryption" {
  bucket = aws_s3_bucket.code.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Lifecycle rule to clean up old versions
resource "aws_s3_bucket_lifecycle_configuration" "code_lifecycle" {
  bucket = aws_s3_bucket.code.id

  rule {
    id     = "cleanup-old-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

# Enable EventBridge notifications
resource "aws_s3_bucket_notification" "code_notification" {
  bucket      = aws_s3_bucket.code.id
  eventbridge = true
}
