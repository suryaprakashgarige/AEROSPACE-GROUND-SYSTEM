# terraform/outputs.tf

output "vpc_id" {
  description = "Assigned AWS VPC resource ID identifier"
  value       = module.vpc.vpc_id
}

output "eks_cluster_endpoint" {
  description = "EKS Master api-server connection endpoint URL string"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_name" {
  description = "EKS cluster control name identifier"
  value       = module.eks.cluster_name
}

output "rds_db_endpoint" {
  description = "RDS Postgres connection string address URI endpoint"
  value       = module.rds.db_endpoint
}
