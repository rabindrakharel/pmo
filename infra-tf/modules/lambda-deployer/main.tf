# ============================================================================
# Lambda Deployer Module - Automated Code Deployment from S3 to EC2
# ============================================================================

terraform {
  required_providers {
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }
}

# Package Lambda function
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_file = "${path.module}/lambda_function.py"
  output_path = "${path.module}/lambda_deployment.zip"
}

# IAM Role for Lambda
resource "aws_iam_role" "lambda_role" {
  name = "${var.project_name}-lambda-deployer-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-lambda-deployer-role"
  })
}

# Lambda Basic Execution Policy
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Policy for S3 access
resource "aws_iam_role_policy" "lambda_s3_policy" {
  name = "${var.project_name}-lambda-s3-policy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:GetObject",
        "s3:GetObjectVersion",
        "s3:ListBucket"
      ]
      Resource = [
        var.code_bucket_arn,
        "${var.code_bucket_arn}/*"
      ]
    }]
  })
}

# Policy for SSM access (to execute commands on EC2)
resource "aws_iam_role_policy" "lambda_ssm_policy" {
  name = "${var.project_name}-lambda-ssm-policy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ssm:SendCommand",
        "ssm:GetCommandInvocation",
        "ssm:ListCommandInvocations",
        "ec2:DescribeInstances",
        "ec2:DescribeInstanceStatus"
      ]
      Resource = "*"
    }]
  })
}

# Lambda Function
resource "aws_lambda_function" "deployer" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "${var.project_name}-code-deployer"
  role             = aws_iam_role.lambda_role.arn
  handler          = "lambda_function.lambda_handler"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  runtime          = "python3.11"
  timeout          = 300  # 5 minutes
  memory_size      = 256

  environment {
    variables = {
      EC2_INSTANCE_ID = var.ec2_instance_id
      DEPLOY_PATH     = "/opt/${var.project_name}"
      PROJECT_NAME    = var.project_name
    }
  }

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-code-deployer"
  })
}

# CloudWatch Log Group for Lambda
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${aws_lambda_function.deployer.function_name}"
  retention_in_days = 7

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-lambda-deployer-logs"
  })
}

# EventBridge Rule - Trigger on S3 upload
resource "aws_cloudwatch_event_rule" "s3_upload" {
  name        = "${var.project_name}-code-upload-trigger"
  description = "Trigger deployment when code is uploaded to S3"

  event_pattern = jsonencode({
    source      = ["aws.s3"]
    detail-type = ["Object Created"]
    detail = {
      bucket = {
        name = [var.code_bucket_name]
      }
      object = {
        key = [{
          suffix = ".tar.gz"
        }]
      }
    }
  })

  # Tags removed due to IAM user lacking events:TagResource permission
  lifecycle {
    ignore_changes = [tags, tags_all]
  }
}

# EventBridge Target - Lambda Function
resource "aws_cloudwatch_event_target" "lambda" {
  rule      = aws_cloudwatch_event_rule.s3_upload.name
  target_id = "DeploymentLambda"
  arn       = aws_lambda_function.deployer.arn
}

# Lambda Permission for EventBridge
resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.deployer.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.s3_upload.arn
}
