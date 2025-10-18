# ============================================================================
# S3 Module Outputs
# ============================================================================

output "bucket_name" {
  description = "S3 bucket name"
  value       = aws_s3_bucket.coherent_artifacts.id
}

output "bucket_arn" {
  description = "S3 bucket ARN"
  value       = aws_s3_bucket.coherent_artifacts.arn
}

output "bucket_region" {
  description = "S3 bucket region"
  value       = aws_s3_bucket.coherent_artifacts.region
}
