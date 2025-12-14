import { createWorker } from 'tesseract.js';

/**
 * Extract text from image using OCR (for scanned PDFs/images)
 */
export async function extractTextWithOCR(file: File): Promise<string> {
  try {
    const worker = await createWorker('eng');
    
    // For PDFs, we'd need to convert to image first
    // For now, this handles image files
    const { data: { text } } = await worker.recognize(file);
    
    await worker.terminate();
    
    // Clean up the text
    let cleaned = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    cleaned = cleaned.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
    
    return cleaned.trim();
  } catch (error: any) {
    const errorMsg = error?.message || error?.toString() || 'Unknown error';
    throw new Error(`OCR failed: ${errorMsg}`);
  }
}

/**
 * Check if file is an image that might need OCR
 */
export function isImageFile(file: File): boolean {
  const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff'];
  return imageTypes.includes(file.type) || 
         /\.(jpg|jpeg|png|gif|bmp|tiff)$/i.test(file.name);
}

