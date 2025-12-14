import * as pdfjsLib from 'pdfjs-dist';

// Set worker source - use reliable CDN with fallback
// For pdfjs-dist 5.x, the worker file is at build/pdf.worker.min.js
const PDFJS_VERSION = '5.4.449';

// Initialize worker source with multiple CDN fallbacks
function initializeWorker() {
  if (pdfjsLib.GlobalWorkerOptions.workerSrc) {
    return; // Already initialized
  }
  
  // Use jsdelivr CDN (most reliable)
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.js`;
}

// Initialize on module load
initializeWorker();

/**
 * Extract text from PDF file using pdfjs-dist
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    // Ensure worker is initialized
    initializeWorker();
    
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ 
      data: arrayBuffer,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
      verbosity: 0 // Reduce console warnings
    });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    
    // Extract text from all pages
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Combine all text items
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      fullText += pageText + '\n';
    }
    
    // Clean up the text
    let cleaned = fullText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    cleaned = cleaned.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
    
    return cleaned.trim();
  } catch (error: any) {
    // Provide more helpful error message
    const errorMsg = error?.message || error?.toString() || 'Unknown error';
    if (errorMsg.includes('worker') || errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
      throw new Error(`PDF worker failed to load. Please check your internet connection or try again.`);
    }
    throw new Error(`Failed to parse PDF: ${errorMsg}`);
  }
}

/**
 * Check if file is PDF
 */
export function isPDFFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

