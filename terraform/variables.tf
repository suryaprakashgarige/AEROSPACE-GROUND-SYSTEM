# terraform/variables.tf

variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "Target AWS cloud provider region"
}

variable "environment" {
  type        = string
  default     = "production"
  description = "Resource deployment scope namespace"
}

variable "project" {
  type        = string
  default     = "solvrex-satellite-telemetry"
  description = "Resource project tag prefix name"
}

variable "db_username" {
  type        = string
  default     = "postgres"
  description = "Database master administrator user username"
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "Database master administrator account password"
}
