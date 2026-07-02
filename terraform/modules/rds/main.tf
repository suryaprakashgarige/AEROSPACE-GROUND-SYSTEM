# terraform/modules/rds/main.tf

resource "aws_security_group" "db" {
  name        = "${var.project}-db-sg"
  description = "Allow inbound PostgreSQL traffic from EKS worker nodes"
  vpc_id      = var.vpc_id

  ingress {
    description = "Allow PostgreSQL"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"] # Restricted to VPC CIDR range
  }

  egress {
    from_port        = 0
    to_port          = 0
    protocol         = "-1"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }

  tags = {
    Name = "${var.project}-db-sg"
  }
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.project}-db-subnet-group"
  subnet_ids = var.db_subnets
  tags = {
    Name = "${var.project}-db-subnet-group"
  }
}

resource "aws_db_instance" "this" {
  identifier             = "${var.project}-db"
  instance_class         = "db.t3.micro"
  allocated_storage      = 20
  engine                 = "postgres"
  engine_version         = "15.4"
  username               = var.db_username
  password               = var.db_password
  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.db.id]
  skip_final_snapshot    = true
  publicly_accessible    = false

  tags = {
    Name = "${var.project}-postgres"
  }
}

# Module Outputs
output "db_endpoint" {
  value = aws_db_instance.this.endpoint
}

# Variables Definition
variable "environment" { type = string }
variable "project" { type = string }
variable "vpc_id" { type = string }
variable "db_subnets" { type = list(string) }
variable "db_username" { type = string }
variable "db_password" { type = string }
