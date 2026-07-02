# terraform/main.tf

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    bucket         = "solvrex-tfstate-bucket"
    key            = "telemetry-system/production/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "solvrex-tflocks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Environment = var.environment
      Project     = var.project
      ManagedBy   = "Terraform"
    }
  }
}

# Network VPC Module
module "vpc" {
  source      = "./modules/vpc"
  environment = var.environment
  project     = var.project
}

# EKS Cluster Kubernetes Module
module "eks" {
  source          = "./modules/eks"
  environment     = var.environment
  project         = var.project
  vpc_id          = module.vpc.vpc_id
  private_subnets = module.vpc.private_subnets
}

# RDS PostgreSQL Database Instance Module
module "rds" {
  source          = "./modules/rds"
  environment     = var.environment
  project         = var.project
  vpc_id          = module.vpc.vpc_id
  db_subnets      = module.vpc.database_subnets
  db_username     = var.db_username
  db_password     = var.db_password
}
