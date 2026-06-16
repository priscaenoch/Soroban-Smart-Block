variable "environment" {}
variable "domain_name" {}
variable "alb_dns_name" {}
variable "alb_zone_id" {}

locals {
  subdomain = var.environment == "production" ? var.domain_name : "${var.environment}.${var.domain_name}"
}

data "aws_route53_zone" "main" {
  name         = var.domain_name
  private_zone = false
}

resource "aws_route53_record" "app" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = local.subdomain
  type    = "A"

  alias {
    name                   = var.alb_dns_name
    zone_id                = var.alb_zone_id
    evaluate_target_health = true
  }
}

output "app_url" { value = "https://${local.subdomain}" }
