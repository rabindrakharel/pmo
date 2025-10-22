# ============================================================================
# S3 Code Bucket Module Outputs
# ============================================================================

output "bucket_name" {
  description = "Name of the code deployment bucket"
  value       = aws_s3_bucket.code.id
}

output "bucket_arn" {
  description = "ARN of the code deployment bucket"
  value       = aws_s3_bucket.code.arn
}

output "bucket_id" {
  description = "ID of the code deployment bucket"
  value       = aws_s3_bucket.code.id
}
