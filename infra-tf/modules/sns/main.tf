# ============================================================================
# SNS Module - SMS Sending Service
# ============================================================================

# SNS Topic for Application Notifications
resource "aws_sns_topic" "app_notifications" {
  name = "${var.project_name}-app-notifications"

  tags = var.global_tags
}

# SNS SMS Preferences (Account Level)
resource "aws_sns_sms_preferences" "main" {
  monthly_spend_limit                   = var.monthly_sms_spend_limit
  default_sender_id                     = var.default_sender_id
  default_sms_type                      = var.default_sms_type
  delivery_status_iam_role_arn          = aws_iam_role.sns_delivery_status.arn
  delivery_status_success_sampling_rate = var.delivery_status_success_sampling_rate
  usage_report_s3_bucket                = var.usage_report_s3_bucket != "" ? var.usage_report_s3_bucket : null
}

# IAM Role for SNS SMS Delivery Status
resource "aws_iam_role" "sns_delivery_status" {
  name = "${var.project_name}-sns-delivery-status"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "sns.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = var.global_tags
}

# IAM Policy for SNS to write logs
resource "aws_iam_role_policy" "sns_delivery_status" {
  name = "${var.project_name}-sns-delivery-status"
  role = aws_iam_role.sns_delivery_status.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:PutMetricFilter",
          "logs:PutRetentionPolicy"
        ]
        Resource = "*"
      }
    ]
  })
}

# CloudWatch Log Group for SNS SMS Delivery Logs
resource "aws_cloudwatch_log_group" "sns_sms_delivery" {
  name              = "/aws/sns/${var.project_name}/sms/delivery"
  retention_in_days = var.log_retention_days

  tags = var.global_tags
}

# IAM Policy for SNS Publish (SMS and Topics)
resource "aws_iam_policy" "sns_publish" {
  name        = "${var.project_name}-sns-publish"
  description = "Allow publishing to SNS for SMS and notifications"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sns:Publish",
          "sns:PublishBatch"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "sns:GetSMSAttributes",
          "sns:SetSMSAttributes"
        ]
        Resource = "*"
      }
    ]
  })

  tags = var.global_tags
}

# Attach policy to EC2 instance role if provided
resource "aws_iam_role_policy_attachment" "sns_publish" {
  count      = var.ec2_role_name != "" ? 1 : 0
  role       = var.ec2_role_name
  policy_arn = aws_iam_policy.sns_publish.arn
}

# SNS Topic for SMS Delivery Status Updates (optional)
resource "aws_sns_topic" "sms_delivery_status" {
  name = "${var.project_name}-sms-delivery-status"

  tags = var.global_tags
}

# SNS Topic Subscription for Email Notifications (optional)
resource "aws_sns_topic_subscription" "sms_delivery_email" {
  count     = var.notification_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.sms_delivery_status.arn
  protocol  = "email"
  endpoint  = var.notification_email
}
