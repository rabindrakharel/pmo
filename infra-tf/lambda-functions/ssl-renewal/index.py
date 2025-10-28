"""
============================================================================
Lambda Function - SSL Certificate Renewal
============================================================================
This Lambda function triggers SSL certificate renewal on EC2 instances
using AWS Systems Manager (SSM) Run Command
============================================================================
"""

import json
import os
import boto3
from datetime import datetime

# Initialize AWS clients
ssm_client = boto3.client('ssm')
ec2_client = boto3.client('ec2')

# Configuration from environment variables
EC2_INSTANCE_ID = os.environ.get('EC2_INSTANCE_ID')
# AWS_REGION is automatically available in Lambda environment
AWS_REGION = os.environ.get('AWS_REGION', os.environ.get('AWS_DEFAULT_REGION', 'us-east-1'))

def lambda_handler(event, context):
    """
    Main Lambda handler function

    Triggers SSL certificate renewal on the specified EC2 instance
    """

    print(f"Lambda invoked at: {datetime.utcnow().isoformat()}")
    print(f"Event: {json.dumps(event)}")

    # Validate configuration
    if not EC2_INSTANCE_ID:
        error_msg = "ERROR: EC2_INSTANCE_ID environment variable not set"
        print(error_msg)
        return {
            'statusCode': 500,
            'body': json.dumps({'error': error_msg})
        }

    print(f"Target EC2 Instance: {EC2_INSTANCE_ID}")

    try:
        # Check if instance is running
        instance_status = check_instance_status(EC2_INSTANCE_ID)
        print(f"Instance status: {instance_status}")

        if instance_status != 'running':
            error_msg = f"Instance {EC2_INSTANCE_ID} is not running (status: {instance_status})"
            print(error_msg)
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'error': error_msg,
                    'instance_id': EC2_INSTANCE_ID,
                    'instance_status': instance_status
                })
            }

        # Execute SSL renewal command via SSM
        command_id = execute_ssl_renewal(EC2_INSTANCE_ID)

        print(f"SSL renewal command initiated successfully")
        print(f"SSM Command ID: {command_id}")

        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'SSL renewal command executed successfully',
                'instance_id': EC2_INSTANCE_ID,
                'command_id': command_id,
                'timestamp': datetime.utcnow().isoformat()
            })
        }

    except Exception as e:
        error_msg = f"Error executing SSL renewal: {str(e)}"
        print(error_msg)

        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': error_msg,
                'instance_id': EC2_INSTANCE_ID
            })
        }


def check_instance_status(instance_id):
    """
    Check if EC2 instance is running

    Args:
        instance_id: EC2 instance ID

    Returns:
        str: Instance state (running, stopped, etc.)
    """
    try:
        response = ec2_client.describe_instances(InstanceIds=[instance_id])

        if not response['Reservations']:
            return 'not_found'

        instance = response['Reservations'][0]['Instances'][0]
        return instance['State']['Name']

    except Exception as e:
        print(f"Error checking instance status: {str(e)}")
        raise


def execute_ssl_renewal(instance_id):
    """
    Execute SSL certificate renewal command on EC2 via SSM

    Args:
        instance_id: EC2 instance ID

    Returns:
        str: SSM Command ID
    """

    # Command to execute on EC2
    # This runs the renewal script created during SSL setup
    renewal_command = """
#!/bin/bash
set -e

echo "============================================"
echo "SSL Certificate Renewal - Lambda Triggered"
echo "Started at: $(date)"
echo "============================================"

# Run the renewal script
if [ -x /usr/local/bin/renew-ssl-certificates ]; then
    /usr/local/bin/renew-ssl-certificates
else
    echo "ERROR: Renewal script not found or not executable"
    exit 1
fi

echo "Completed at: $(date)"
echo "============================================"
"""

    try:
        response = ssm_client.send_command(
            InstanceIds=[instance_id],
            DocumentName='AWS-RunShellScript',
            Comment='SSL Certificate Renewal - Automated via Lambda',
            Parameters={
                'commands': [renewal_command],
                'executionTimeout': ['600']  # 10 minute timeout
            },
            TimeoutSeconds=600,
            MaxConcurrency='1',
            MaxErrors='1'
        )

        command_id = response['Command']['CommandId']
        return command_id

    except Exception as e:
        print(f"Error executing SSM command: {str(e)}")
        raise


def get_command_status(command_id, instance_id):
    """
    Get status of SSM command execution

    Args:
        command_id: SSM Command ID
        instance_id: EC2 instance ID

    Returns:
        dict: Command status information
    """
    try:
        response = ssm_client.get_command_invocation(
            CommandId=command_id,
            InstanceId=instance_id
        )

        return {
            'status': response['Status'],
            'status_details': response.get('StatusDetails', ''),
            'output': response.get('StandardOutputContent', ''),
            'error': response.get('StandardErrorContent', '')
        }

    except Exception as e:
        print(f"Error getting command status: {str(e)}")
        raise
