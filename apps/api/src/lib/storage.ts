import * as Minio from 'minio';
import { config } from './config.js';
import { randomUUID } from 'crypto';

let minioClient: Minio.Client | null = null;

/**
 * Initialize MinIO client
 * Supports both MinIO and S3-compatible storage
 */
export function getStorageClient(): Minio.Client {
  if (!minioClient) {
    const endpoint = config.S3_ENDPOINT || 'http://localhost:9000';
    const cleanEndpoint = endpoint.replace(/^https?:\/\//, '');
    const [host, portStr] = cleanEndpoint.split(':');
    const port = portStr ? parseInt(portStr, 10) : 9000;
    const useSSL = endpoint.startsWith('https://');

    minioClient = new Minio.Client({
      endPoint: host || 'localhost',
      port: port,
      useSSL: useSSL,
      accessKey: config.S3_ACCESS_KEY || 'minio',
      secretKey: config.S3_SECRET_KEY || 'minio123',
    });
  }

  return minioClient;
}

/**
 * Ensure bucket exists, create if it doesn't
 */
export async function ensureBucket(bucketName: string = config.S3_BUCKET): Promise<void> {
  const client = getStorageClient();
  const exists = await client.bucketExists(bucketName);

  if (!exists) {
    await client.makeBucket(bucketName, config.S3_REGION);
    console.log(`Created bucket: ${bucketName}`);
  }
}

/**
 * Upload file to storage
 * @param file - File buffer
 * @param filename - Original filename
 * @param contentType - MIME type
 * @returns Object URL for accessing the file
 */
export async function uploadFile(
  file: Buffer,
  filename: string,
  contentType: string
): Promise<{ url: string; key: string }> {
  const client = getStorageClient();
  const bucketName = config.S3_BUCKET;

  await ensureBucket(bucketName);

  // Generate unique key with original extension
  const ext = filename.split('.').pop() || '';
  const key = `email-images/${randomUUID()}.${ext}`;

  // Upload to MinIO
  await client.putObject(bucketName, key, file, file.length, {
    'Content-Type': contentType,
  });

  // Generate URL
  // For MinIO, we'll use presigned URL that's valid for 7 days
  const url = await client.presignedGetObject(bucketName, key, 7 * 24 * 60 * 60);

  return { url, key };
}

/**
 * Delete file from storage
 * @param key - Object key to delete
 */
export async function deleteFile(key: string): Promise<void> {
  const client = getStorageClient();
  const bucketName = config.S3_BUCKET;

  await client.removeObject(bucketName, key);
}

/**
 * Get public URL for a file
 * @param key - Object key
 * @returns Presigned URL valid for 7 days
 */
export async function getFileUrl(key: string): Promise<string> {
  const client = getStorageClient();
  const bucketName = config.S3_BUCKET;

  return await client.presignedGetObject(bucketName, key, 7 * 24 * 60 * 60);
}
