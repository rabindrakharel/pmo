# ============================================================================
# S3 Module - Coherent PMO Platform
# ============================================================================
# Creates S3 bucket for artifact storage
# ============================================================================

data "aws_caller_identity" "current" {}

# S3 Bucket
resource "aws_s3_bucket" "coherent_artifacts" {
  bucket = "${var.project_name}-artifacts-${var.environment}-${data.aws_caller_identity.current.account_id}"

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-artifacts"
  })
}

# Block public access
resource "aws_s3_bucket_public_access_block" "coherent_artifacts_public_access" {
  bucket = aws_s3_bucket.coherent_artifacts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable versioning
resource "aws_s3_bucket_versioning" "coherent_artifacts_versioning" {
  bucket = aws_s3_bucket.coherent_artifacts.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Enable encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "coherent_artifacts_encryption" {
  bucket = aws_s3_bucket.coherent_artifacts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Lifecycle rule to transition old versions to cheaper storage
resource "aws_s3_bucket_lifecycle_configuration" "coherent_artifacts_lifecycle" {
  bucket = aws_s3_bucket.coherent_artifacts.id

  rule {
    id     = "transition-old-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }

    noncurrent_version_transition {
      noncurrent_days = 90
      storage_class   = "GLACIER"
    }

    noncurrent_version_expiration {
      noncurrent_days = 365
    }
  }
}
