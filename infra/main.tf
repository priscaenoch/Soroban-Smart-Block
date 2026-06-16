terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "soroban-explorer-tfstate"
    key            = "global/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "soroban-explorer-tflock"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "soroban-smart-block"
      ManagedBy   = "terraform"
      Environment = var.environment
    }
  }
}

# ── Networking ────────────────────────────────────────────────────────────────
module "networking" {
  source = "./modules/networking"

  environment    = var.environment
  vpc_cidr       = var.vpc_cidr
  aws_region     = var.aws_region
  azs            = var.availability_zones
}

# ── Database ──────────────────────────────────────────────────────────────────
module "database" {
  source = "./modules/database"

  environment    = var.environment
  vpc_id         = module.networking.vpc_id
  subnet_ids     = module.networking.private_subnet_ids
  db_name        = var.db_name
  db_username    = var.db_username
  instance_class = var.db_instance_class
  multi_az       = var.environment == "production"
}

# ── Compute ───────────────────────────────────────────────────────────────────
module "compute" {
  source = "./modules/compute"

  environment        = var.environment
  vpc_id             = module.networking.vpc_id
  public_subnet_ids  = module.networking.public_subnet_ids
  private_subnet_ids = module.networking.private_subnet_ids
  alb_arn            = module.networking.alb_arn
  indexer_image      = var.indexer_image
  frontend_image     = var.frontend_image
  database_url       = module.database.connection_string
  desired_count      = var.environment == "production" ? 2 : 1
}

# ── DNS ───────────────────────────────────────────────────────────────────────
module "dns" {
  source = "./modules/dns"

  environment     = var.environment
  domain_name     = var.domain_name
  alb_dns_name    = module.networking.alb_dns_name
  alb_zone_id     = module.networking.alb_zone_id
}
