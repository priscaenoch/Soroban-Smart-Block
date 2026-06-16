variable "environment" {}
variable "vpc_id" {}
variable "subnet_ids" {}
variable "db_name" {}
variable "db_username" { sensitive = true }
variable "instance_class" {}
variable "multi_az" { default = false }

resource "aws_security_group" "db" {
  name   = "soroban-explorer-db-${var.environment}"
  vpc_id = var.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_subnet_group" "main" {
  name       = "soroban-explorer-${var.environment}"
  subnet_ids = var.subnet_ids
}

resource "aws_db_instance" "postgres" {
  identifier              = "soroban-explorer-${var.environment}"
  engine                  = "postgres"
  engine_version          = "16"
  instance_class          = var.instance_class
  allocated_storage       = var.environment == "production" ? 100 : 20
  max_allocated_storage   = var.environment == "production" ? 500 : 0
  db_name                 = var.db_name
  username                = var.db_username
  manage_master_user_password = true
  db_subnet_group_name    = aws_db_subnet_group.main.name
  vpc_security_group_ids  = [aws_security_group.db.id]
  multi_az                = var.multi_az
  backup_retention_period = var.environment == "production" ? 7 : 1
  deletion_protection     = var.environment == "production"
  skip_final_snapshot     = var.environment != "production"

  tags = { Name = "soroban-explorer-db-${var.environment}" }
}

output "endpoint"          { value = aws_db_instance.postgres.endpoint }
output "connection_string" {
  value     = "postgresql://${var.db_username}@${aws_db_instance.postgres.endpoint}/${var.db_name}"
  sensitive = true
}
