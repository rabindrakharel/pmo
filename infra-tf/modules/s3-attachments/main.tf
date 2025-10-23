# ============================================================================
# S3 Attachments Module - PMO Platform
# ============================================================================
# Creates S3 bucket for multi-tenant attachment storage
# ============================================================================

data "aws_caller_identity" "current" {}

# S3 Bucket
resource "aws_s3_bucket" "cohuron_attachments" {
  bucket = "${var.project_name}-attachments-${var.environment}-${data.aws_caller_identity.current.account_id}"

  tags = merge(var.global_tags, {
    Name    = "${var.project_name}-attachments"
    Purpose = "Multi-tenant attachment storage for PMO entities"
    Type    = "attachments"
  })
}

# Block public access
resource "aws_s3_bucket_public_access_block" "attachments_public_access" {
  bucket = aws_s3_bucket.cohuron_attachments.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable versioning
resource "aws_s3_bucket_versioning" "attachments_versioning" {
  bucket = aws_s3_bucket.cohuron_attachments.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Enable encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "attachments_encryption" {
  bucket = aws_s3_bucket.cohuron_attachments.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# CORS configuration for presigned URL uploads
resource "aws_s3_bucket_cors_configuration" "attachments_cors" {
  bucket = aws_s3_bucket.cohuron_attachments.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = var.allowed_origins
    expose_headers  = ["ETag", "Content-Length", "Content-Type"]
    max_age_seconds = 3000
  }
}

# Lifecycle policy to optimize storage costs
resource "aws_s3_bucket_lifecycle_configuration" "attachments_lifecycle" {
  bucket = aws_s3_bucket.cohuron_attachments.id

  rule {
    id     = "transition-old-attachments"
    status = "Enabled"

    filter {}

    # Transition current versions to IA after 90 days
    transition {
      days          = var.lifecycle_transition_days
      storage_class = "STANDARD_IA"
    }

    # Transition current versions to Glacier after 180 days
    transition {
      days          = var.lifecycle_glacier_days
      storage_class = "GLACIER"
    }

    # Transition noncurrent versions to IA after 30 days
    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }

    # Delete noncurrent versions after 365 days
    noncurrent_version_expiration {
      noncurrent_days = 365
    }
  }

  rule {
    id     = "abort-incomplete-multipart-uploads"
    status = "Enabled"

    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# Bucket metric configuration (optional - for monitoring)
resource "aws_s3_bucket_metric" "attachments_metrics" {
  bucket = aws_s3_bucket.cohuron_attachments.id
  name   = "EntireBucket"
}
