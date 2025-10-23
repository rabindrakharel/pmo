import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { fromIni } from '@aws-sdk/credential-providers';
import { config } from '@/lib/config.js';
import { logger } from '@/lib/logger.js';
import crypto from 'crypto';

/**
 * S3 Attachment Service
 *
 * Provides reusable S3 operations for attachment management with the following features:
 * - Multi-tenant storage structure: tenant_id/entity/entity_id/attachment_id_hash.extension
 * - Presigned URLs for secure uploads and downloads
 * - AWS SDK v3 with IAM role authentication (profile: cohuron)
 * - Default tenant_id: 'demo'
 */

export interface AttachmentMetadata {
  tenantId?: string;
  entityType: string;
  entityId: string;
  fileName: string;
  contentType?: string;
}

export interface PresignedUrlResult {
  url: string;
  objectKey: string;
  expiresIn: number;
}

export interface AttachmentListItem {
  key: string;
  size: number;
  lastModified: Date;
}

/**
 * S3 Attachment Service Class
 */
export class S3AttachmentService {
  private s3Client: S3Client;
  private bucketName: string;
  private defaultTenantId: string = 'demo';

  constructor() {
    // Initialize S3 Client with AWS credentials
    // Use fromIni to explicitly load credentials from AWS profile
    const clientConfig: any = {
      region: config.AWS_REGION,
    };

    // If AWS_PROFILE is configured, use fromIni to load credentials from ~/.aws/credentials
    if (config.AWS_PROFILE) {
      clientConfig.credentials = fromIni({ profile: config.AWS_PROFILE });
      logger.info(`Using AWS profile: ${config.AWS_PROFILE}`);
    } else {
      // Otherwise use default credential provider chain:
      // 1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
      // 2. Shared credentials file (~/.aws/credentials)
      // 3. IAM role (when running on EC2)
      logger.info('Using default AWS credential provider chain');
    }

    this.s3Client = new S3Client(clientConfig);
    this.bucketName = config.S3_ATTACHMENTS_BUCKET;

    logger.info(`S3AttachmentService initialized with bucket: ${this.bucketName}, region: ${config.AWS_REGION}`);
  }

  /**
   * Generate S3 object key with hierarchical structure
   * Format: tenant_id={tenant}/entity={entity}/entity_id={id}/attachment_hash.extension
   */
  private generateObjectKey(metadata: AttachmentMetadata): string {
    const tenantId = metadata.tenantId || this.defaultTenantId;
    const hash = crypto.randomBytes(16).toString('hex');
    const extension = metadata.fileName.split('.').pop() || '';

    return `tenant_id=${tenantId}/entity=${metadata.entityType}/entity_id=${metadata.entityId}/${hash}.${extension}`;
  }

  /**
   * Generate presigned URL for file upload
   * @param metadata - Attachment metadata (tenant, entity, entityId, fileName)
   * @param expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
   * @returns Presigned upload URL and object key
   */
  async generatePresignedUploadUrl(
    metadata: AttachmentMetadata,
    expiresIn: number = 3600
  ): Promise<PresignedUrlResult> {
    const objectKey = this.generateObjectKey(metadata);

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: objectKey,
      ContentType: metadata.contentType || 'application/octet-stream',
    });

    const url = await getSignedUrl(this.s3Client, command, { expiresIn });

    logger.info(`Generated presigned upload URL for: ${objectKey}`);

    return {
      url,
      objectKey,
      expiresIn,
    };
  }

  /**
   * Generate presigned URL for file download
   * @param objectKey - S3 object key
   * @param expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
   * @returns Presigned download URL
   */
  async generatePresignedDownloadUrl(
    objectKey: string,
    expiresIn: number = 3600
  ): Promise<PresignedUrlResult> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: objectKey,
    });

    const url = await getSignedUrl(this.s3Client, command, { expiresIn });

    logger.info(`Generated presigned download URL for: ${objectKey}`);

    return {
      url,
      objectKey,
      expiresIn,
    };
  }

  /**
   * Delete attachment from S3
   * @param objectKey - S3 object key
   * @returns Success status
   */
  async deleteAttachment(objectKey: string): Promise<boolean> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
      });

      await this.s3Client.send(command);
      logger.info(`Deleted attachment: ${objectKey}`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete attachment ${objectKey}:`, error);
      return false;
    }
  }

  /**
   * List attachments for a specific entity
   * @param tenantId - Tenant ID (optional, defaults to 'demo')
   * @param entityType - Entity type (e.g., 'project', 'task')
   * @param entityId - Entity ID
   * @returns List of attachment objects
   */
  async listAttachments(
    tenantId: string | undefined,
    entityType: string,
    entityId: string
  ): Promise<AttachmentListItem[]> {
    const tenant = tenantId || this.defaultTenantId;
    const prefix = `tenant_id=${tenant}/entity=${entityType}/entity_id=${entityId}/`;

    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
      });

      const response = await this.s3Client.send(command);

      const items: AttachmentListItem[] = (response.Contents || []).map(obj => ({
        key: obj.Key!,
        size: obj.Size || 0,
        lastModified: obj.LastModified || new Date(),
      }));

      logger.info(`Listed ${items.length} attachments for ${prefix}`);
      return items;
    } catch (error) {
      logger.error(`Failed to list attachments for ${prefix}:`, error);
      return [];
    }
  }

  /**
   * Verify S3 connection and bucket access
   * @returns Success status
   */
  async verifyConnection(): Promise<boolean> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        MaxKeys: 1,
      });

      await this.s3Client.send(command);
      logger.info(`S3 connection verified for bucket: ${this.bucketName}`);
      return true;
    } catch (error) {
      logger.error(`Failed to verify S3 connection:`, error);
      return false;
    }
  }
}

// Export singleton instance
export const s3AttachmentService = new S3AttachmentService();
