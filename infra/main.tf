###############################################################################
# ContractorBidder infrastructure (skeleton).
#
# This is an intentionally minimal Terraform skeleton outlining the AWS shape
# described in the spec (ALB + ECS/Fargate, RDS Postgres+PostGIS, ElastiCache
# Redis, S3 for media). Resource bodies are stubbed with TODOs so `terraform
# validate` stays meaningful without provisioning anything by accident.
###############################################################################

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Configure remote state before use, e.g.:
  # backend "s3" {
  #   bucket = "contractor-bidder-tfstate"
  #   key    = "env/terraform.tfstate"
  #   region = "us-east-1"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "ContractorBidder"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# --- Networking -------------------------------------------------------------
# TODO: VPC with public/private subnets across 2+ AZs (multi-region ready).
# module "vpc" { source = "terraform-aws-modules/vpc/aws" ... }

# --- Database (RDS Postgres + PostGIS) --------------------------------------
# TODO: aws_db_instance / aws_rds_cluster (Aurora Postgres). Enable the
# `postgis` extension via migrations. Encrypt at rest, private subnet only.

# --- Cache / Queue (ElastiCache Redis + SQS) --------------------------------
# TODO: aws_elasticache_replication_group; aws_sqs_queue for notification fan-out.

# --- Object storage (S3 for media) ------------------------------------------
# TODO: aws_s3_bucket with SSE, block public access; signed PUT/GET from API.

# --- Compute (ECS Fargate behind ALB) ---------------------------------------
# TODO: aws_ecs_cluster, aws_ecs_service (api), aws_lb (ALB), task definitions,
# autoscaling on CPU/RPS for stateless horizontal scaling.
