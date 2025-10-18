# ============================================================================
# EC2 Module Outputs
# ============================================================================

output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.app_server.id
}

output "instance_private_ip" {
  description = "EC2 instance private IP"
  value       = aws_instance.app_server.private_ip
}

output "instance_public_ip" {
  description = "EC2 instance Elastic IP"
  value       = aws_eip.app_eip.public_ip
}

output "ec2_role_name" {
  description = "IAM role name for EC2"
  value       = aws_iam_role.ec2_role.name
}

output "ec2_role_arn" {
  description = "IAM role ARN for EC2"
  value       = aws_iam_role.ec2_role.arn
}

output "key_pair_name" {
  description = "SSH key pair name"
  value       = aws_key_pair.coherent_key.key_name
}
