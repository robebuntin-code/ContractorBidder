variable "aws_region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment name (dev/staging/prod)."
  type        = string
  default     = "dev"
}

variable "db_instance_class" {
  description = "RDS instance class for Postgres."
  type        = string
  default     = "db.t4g.micro"
}

variable "api_desired_count" {
  description = "Number of ECS Fargate tasks for the API service."
  type        = number
  default     = 2
}
