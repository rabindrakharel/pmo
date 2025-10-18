# ============================================================================
# RDS Module Outputs
# ============================================================================

output "db_endpoint" {
  description = "RDS database endpoint"
  value       = aws_db_instance.coherent_db.endpoint
}

output "db_address" {
  description = "RDS database host address"
  value       = aws_db_instance.coherent_db.address
}

output "db_port" {
  description = "RDS database port"
  value       = aws_db_instance.coherent_db.port
}

output "db_name" {
  description = "Database name"
  value       = aws_db_instance.coherent_db.db_name
}

output "db_instance_id" {
  description = "RDS instance ID"
  value       = aws_db_instance.coherent_db.id
}

output "db_arn" {
  description = "RDS instance ARN"
  value       = aws_db_instance.coherent_db.arn
}
