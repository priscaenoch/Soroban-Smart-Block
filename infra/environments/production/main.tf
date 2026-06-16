module "production" {
  source = "../../"

  environment        = "production"
  aws_region         = "us-east-1"
  vpc_cidr           = "10.0.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]
  domain_name        = var.domain_name
  db_name            = "soroban_explorer"
  db_username        = var.db_username
  db_instance_class  = "db.t3.medium"
  indexer_image      = var.indexer_image
  frontend_image     = var.frontend_image
}

variable "domain_name" {}
variable "db_username" { sensitive = true }
variable "indexer_image" {}
variable "frontend_image" {}
