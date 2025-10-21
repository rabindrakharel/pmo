import { apiClient } from './api';

/**
 * Upload an image file to the server
 * @param file - The image file to upload
 * @returns Promise with the uploaded image URL
 */
export async function uploadImage(file: File): Promise<{ url: string; key: string }> {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await apiClient.post('/api/v1/upload/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  } catch (error) {
    console.error('Image upload failed:', error);
    throw new Error('Failed to upload image');
  }
}

/**
 * Convert a file to base64 data URL (fallback for when upload fails)
 * @param file - The file to convert
 * @returns Promise with base64 data URL
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
