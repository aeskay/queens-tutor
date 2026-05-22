import * as pdfjs from 'pdfjs-dist';

// Use the CDN with the exact matching version to avoid Vite crashing when proxying the worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export async function extractTextFromPDF(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
        fullText += pageText + '\n';
    }

    return fullText;
}

export async function extractTextFromMultiplePDFs(files: File[]): Promise<string> {
    let combinedText = '';
    for (const file of files) {
        const text = await extractTextFromPDF(file);
        combinedText += `\n--- SOURCE: ${file.name} ---\n${text}\n`;
    }
    return combinedText.trim();
}
