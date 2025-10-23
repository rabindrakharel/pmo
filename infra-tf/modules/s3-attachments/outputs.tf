output "bucket_name" {
  description = "Name of the S3 attachments bucket"
  value       = aws_s3_bucket.cohuron_attachments.bucket
}

output "bucket_arn" {
  description = "ARN of the S3 attachments bucket"
  value       = aws_s3_bucket.cohuron_attachments.arn
}

output "bucket_id" {
  description = "ID of the S3 attachments bucket"
  value       = aws_s3_bucket.cohuron_attachments.id
}

output "bucket_region" {
  description = "Region of the S3 attachments bucket"
  value       = aws_s3_bucket.cohuron_attachments.region
}

output "bucket_domain_name" {
  description = "Domain name of the S3 attachments bucket"
  value       = aws_s3_bucket.cohuron_attachments.bucket_domain_name
}
