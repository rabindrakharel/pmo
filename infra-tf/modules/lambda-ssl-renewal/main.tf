# ============================================================================
# Lambda Module - SSL Certificate Renewal
# ============================================================================
# Creates Lambda function to trigger SSL renewal on EC2 via SSM
# ============================================================================

# ============================================================================
# IAM Role for Lambda
# ============================================================================

resource "aws_iam_role" "lambda_role" {
  name = "${var.project_name}-ssl-renewal-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-ssl-renewal-lambda-role"
  })
}

# CloudWatch Logs policy
resource "aws_iam_role_policy" "lambda_logs_policy" {
  name = "${var.project_name}-lambda-logs-policy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# SSM policy for sending commands to EC2
resource "aws_iam_role_policy" "lambda_ssm_policy" {
  name = "${var.project_name}-lambda-ssm-policy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:SendCommand",
          "ssm:GetCommandInvocation",
          "ssm:ListCommands",
          "ssm:ListCommandInvocations"
        ]
        Resource = [
          "arn:aws:ssm:${var.aws_region}:*:document/AWS-RunShellScript",
          "arn:aws:ec2:${var.aws_region}:*:instance/${var.ec2_instance_id}"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:DescribeInstances",
          "ec2:DescribeInstanceStatus"
        ]
        Resource = "*"
      }
    ]
  })
}

# ============================================================================
# Lambda Function
# ============================================================================

# Archive the Lambda function code
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.root}/lambda-functions/ssl-renewal"
  output_path = "${path.root}/.terraform/lambda-ssl-renewal.zip"
}

resource "aws_lambda_function" "ssl_renewal" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "${var.project_name}-ssl-renewal"
  role            = aws_iam_role.lambda_role.arn
  handler         = "index.lambda_handler"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  runtime = "python3.11"
  timeout = 300  # 5 minutes

  environment {
    variables = {
      EC2_INSTANCE_ID = var.ec2_instance_id
      # AWS_REGION is automatically provided by Lambda runtime
    }
  }

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-ssl-renewal"
  })
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${aws_lambda_function.ssl_renewal.function_name}"
  retention_in_days = 30

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-ssl-renewal-logs"
  })
}

# ============================================================================
# EventBridge Rule for Monthly Trigger
# ============================================================================

# EventBridge rule to trigger Lambda monthly (1st of each month at 2 AM UTC)
resource "aws_cloudwatch_event_rule" "monthly_trigger" {
  name                = "${var.project_name}-ssl-renewal-monthly"
  description         = "Trigger SSL certificate renewal monthly"
  schedule_expression = "cron(0 2 1 * ? *)"  # 2 AM UTC on the 1st of each month

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-ssl-renewal-schedule"
  })
}

# Target the Lambda function
resource "aws_cloudwatch_event_target" "lambda_target" {
  rule      = aws_cloudwatch_event_rule.monthly_trigger.name
  target_id = "ssl-renewal-lambda"
  arn       = aws_lambda_function.ssl_renewal.arn
}

# Permission for EventBridge to invoke Lambda
resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ssl_renewal.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.monthly_trigger.arn
}

# ============================================================================
# EventBridge Rule for Manual Testing (Weekly)
# ============================================================================

# Optional: Weekly trigger for testing (commented out by default)
# Uncomment to enable weekly SSL renewal checks

# resource "aws_cloudwatch_event_rule" "weekly_trigger" {
#   name                = "${var.project_name}-ssl-renewal-weekly"
#   description         = "Trigger SSL certificate renewal weekly (for testing)"
#   schedule_expression = "cron(0 2 ? * SUN *)"  # 2 AM UTC every Sunday
#
#   tags = merge(var.global_tags, {
#     Name = "${var.project_name}-ssl-renewal-weekly"
#   })
# }
#
# resource "aws_cloudwatch_event_target" "lambda_target_weekly" {
#   rule      = aws_cloudwatch_event_rule.weekly_trigger.name
#   target_id = "ssl-renewal-lambda-weekly"
#   arn       = aws_lambda_function.ssl_renewal.arn
# }
#
# resource "aws_lambda_permission" "allow_eventbridge_weekly" {
#   statement_id  = "AllowExecutionFromEventBridgeWeekly"
#   action        = "lambda:InvokeFunction"
#   function_name = aws_lambda_function.ssl_renewal.function_name
#   principal     = "events.amazonaws.com"
#   source_arn    = aws_cloudwatch_event_rule.weekly_trigger.arn
# }
