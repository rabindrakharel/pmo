# ============================================================================
# RDS Module - Coherent PMO Platform
# ============================================================================
# Creates PostgreSQL RDS instance in private subnets
# ============================================================================

# DB Subnet Group
resource "aws_db_subnet_group" "coherent_db_subnet_group" {
  name       = "${var.project_name}-data-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-data-subnet-group"
  })
}

# RDS PostgreSQL Instance
resource "aws_db_instance" "coherent_db" {
  identifier     = "${var.project_name}-db"
  engine         = "postgres"
  engine_version = var.db_engine_version
  instance_class = var.db_instance_class

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password
  port     = 5432

  db_subnet_group_name   = aws_db_subnet_group.coherent_db_subnet_group.name
  vpc_security_group_ids = [var.db_security_group_id]

  backup_retention_period = var.db_backup_retention_period
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  skip_final_snapshot       = var.environment == "dev" ? true : false
  final_snapshot_identifier = var.environment == "dev" ? null : "${var.project_name}-db-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"

  multi_az               = var.environment == "prod" ? true : false
  publicly_accessible    = false
  deletion_protection    = false  # Disabled to allow RDS deletion
  apply_immediately      = true   # Apply deletion protection change immediately

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-db"
  })
}
