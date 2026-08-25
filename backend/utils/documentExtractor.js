import { createRequire } from 'module';
import mammoth from 'mammoth';
import { createWorker } from 'tesseract.js';
import crypto from 'crypto';
import { PDFExtract } from 'pdf.js-extract';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

// Supported mime types and extensions
export const SUPPORTED_FORMATS = {
    'text/plain': ['txt'],
    'application/pdf': ['pdf'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx']
};

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Validates uploaded files count, size, extensions, and mime types.
 */
export const validateFiles = (files) => {
    if (!files || !Array.isArray(files) || files.length === 0) {
        throw new Error('No files provided.');
    }
    if (files.length > 2) {
        throw new Error('Maximum of 2 files can be uploaded per import operation.');
    }

    for (const file of files) {
        // Validate size
        if (file.size > MAX_FILE_SIZE) {
            throw new Error(`File "${file.originalname}" exceeds the 10MB size limit.`);
        }

        // Validate extension and MIME type
        const ext = file.originalname.split('.').pop().toLowerCase();
        const mime = file.mimetype;

        const allowedExtensions = SUPPORTED_FORMATS[mime];
        if (!allowedExtensions || !allowedExtensions.includes(ext)) {
            throw new Error(`Unsupported file type or extension: "${file.originalname}". Only PDF, DOCX, and TXT are supported.`);
        }
    }
};

/**
 * Helper to convert HTML tables from mammoth to Markdown tables
 */
const parseHtmlTableToMarkdown = (htmlTable) => {
    const rows = [];
    const trRegex = /<tr>([\s\S]*?)<\/tr>/gi;
    const tdRegex = /<t[dh]>([\s\S]*?)<\/\s*t[dh]>/gi;
    
    let trMatch;
    while ((trMatch = trRegex.exec(htmlTable)) !== null) {
        const rowCells = [];
        let tdMatch;
        const rowContent = trMatch[1];
        while ((tdMatch = tdRegex.exec(rowContent)) !== null) {
            const cellText = tdMatch[1].replace(/<[^>]*>/g, '').trim();
            rowCells.push(cellText);
        }
        if (rowCells.length > 0) {
            rows.push(rowCells);
        }
    }
    
    if (rows.length === 0) return '';
    
    let markdown = '';
    for (let i = 0; i < rows.length; i++) {
        markdown += '| ' + rows[i].join(' | ') + ' |\n';
        if (i === 0) {
            markdown += '| ' + rows[i].map(() => '---').join(' | ') + ' |\n';
        }
    }
    return markdown.trim();
};

/**
 * Parses DOCX HTML from mammoth into normalized document blocks
 */
export const parseDocxHtmlToBlocks = (html, pageNum = 1) => {
    const blocks = [];
    let sourceIndex = 0;
    
    const elementRegex = /<(p|table|ul|ol|h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let match;
    
    while ((match = elementRegex.exec(html)) !== null) {
        const tag = match[1].toLowerCase();
        const innerContent = match[2];
        
        if (tag === 'p') {
            const text = innerContent.replace(/<[^>]*>/g, '').trim();
            if (text) {
                blocks.push({
                    page: pageNum,
                    type: 'paragraph',
                    text,
                    sourceIndex: sourceIndex++
                });
            }
        } else if (tag === 'table') {
            const tableMarkdown = parseHtmlTableToMarkdown(match[0]);
            if (tableMarkdown) {
                blocks.push({
                    page: pageNum,
                    type: 'table',
                    text: tableMarkdown,
                    sourceIndex: sourceIndex++
                });
            }
        } else if (tag === 'ul' || tag === 'ol') {
            const liRegex = /<li>([\s\S]*?)<\/li>/gi;
            let liMatch;
            while ((liMatch = liRegex.exec(innerContent)) !== null) {
                const text = liMatch[1].replace(/<[^>]*>/g, '').trim();
                if (text) {
                    blocks.push({
                        page: pageNum,
                        type: 'paragraph',
                        text: `- ${text}`,
                        sourceIndex: sourceIndex++
                    });
                }
            }
        } else if (tag.startsWith('h')) {
            const text = innerContent.replace(/<[^>]*>/g, '').trim();
            if (text) {
                blocks.push({
                    page: pageNum,
                    type: 'paragraph',
                    text: `### ${text}`,
                    sourceIndex: sourceIndex++
                });
            }
        }
    }
    
    if (blocks.length === 0) {
        const cleanText = html.replace(/<[^>]*>/g, '').trim();
        if (cleanText) {
            blocks.push({
                page: pageNum,
                type: 'paragraph',
                text: cleanText,
                sourceIndex: 0
            });
        }
    }
    
    return blocks;
};

/**
 * Runs OCR on a base64 image string using tesseract.js.
 */
const runOcrOnImage = async (base64data) => {
    try {
        const imageBuffer = Buffer.from(base64data, 'base64');
        const worker = await createWorker('eng');
        const ret = await worker.recognize(imageBuffer);
        await worker.terminate();
        return ret.data.text;
    } catch (ocrError) {
        console.warn('⚠️ OCR processing failed, falling back to empty string:', ocrError.message);
        // Fallback placeholder to prevent failing entire document parse
        return `[Scanned page image content could not be read: ${ocrError.message}]`;
    }
};

/**
 * Extracts and normalizes content from TXT files.
 */
export const processTxt = async (buffer, filename) => {
    const text = buffer.toString('utf8');
    const documentId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    const blocks = [];
    let sourceIndex = 0;

    // Split text by double newlines to find paragraph/block groupings
    const paragraphs = text.split(/\r?\n\r?\n/);
    for (let p of paragraphs) {
        const trimmed = p.trim();
        if (!trimmed) continue;

        // Split paragraphs into lines
        const lines = trimmed.split(/\r?\n/);
        for (let line of lines) {
            const lineTrimmed = line.trim();
            if (!lineTrimmed) continue;

            blocks.push({
                page: 1,
                type: 'line',
                text: lineTrimmed,
                sourceIndex: sourceIndex++
            });
        }
    }

    return {
        documentId,
        filename,
        type: 'txt',
        pages: 1,
        blocks
    };
};

/**
 * Extracts and normalizes content from DOCX files.
 */
export const processDocx = async (buffer, filename) => {
    const documentId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    
    // Convert docx to clean HTML using mammoth to preserve tables and block boundaries
    const result = await mammoth.convertToHtml({ buffer });
    const html = result.value;

    const blocks = parseDocxHtmlToBlocks(html, 1);

    return {
        documentId,
        filename,
        type: 'docx',
        pages: 1,
        blocks
    };
};

/**
 * Extracts and normalizes content from PDF files.
 * Detects scanned pages and triggers OCR fallback when text density is too low.
 */
export const processPdf = async (buffer, filename) => {
    const documentId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    
    const { PDFParse } = require('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    const pdfData = await parser.getText();
    const pageTexts = pdfData.pages; // array of { text, num }
    const numPages = pdfData.total;

    const blocks = [];
    let sourceIndex = 0;
    let pdfExtractResult = null;

    for (let pt of pageTexts) {
        const pageNum = pt.num;
        let pageText = pt.text;

        // Detect scanned page: text is empty or very short
        const cleanText = pageText.replace(/\s+/g, '').trim();
        const isScanned = cleanText.length < 30;

        if (isScanned) {
            console.log(`🔍 PDF Page ${pageNum} seems scanned (character count: ${cleanText.length}). Checking for images to run OCR fallback...`);
            
            // Lazily parse with pdf.js-extract only when a scanned page is detected
            if (!pdfExtractResult) {
                try {
                    const pdfExtract = new PDFExtract();
                    pdfExtractResult = await new Promise((resolve, reject) => {
                        pdfExtract.extractBuffer(buffer, { includeImages: true }, (err, data) => {
                            if (err) reject(err);
                            else resolve(data);
                        });
                    });
                } catch (err) {
                    console.error('❌ Failed to parse PDF images using pdf.js-extract:', err.message);
                }
            }

            if (pdfExtractResult && pdfExtractResult.pages[pageNum - 1]) {
                const extractedPage = pdfExtractResult.pages[pageNum - 1];
                const images = extractedPage.images || [];
                if (images.length > 0) {
                    console.log(`🖼️ Page ${pageNum} contains ${images.length} images. Selecting largest image for OCR...`);
                    // Sort images by width * height descending to find the main scanned page image
                    images.sort((a, b) => (b.width * b.height) - (a.width * a.height));
                    const targetImage = images[0];

                    if (targetImage && targetImage.base64data) {
                        const ocrText = await runOcrOnImage(targetImage.base64data);
                        pageText = ocrText;
                    }
                } else {
                    console.log(`⚠️ Page ${pageNum} is empty but contains no extractable images.`);
                }
            }
        }

        // Split resolved page text into blocks
        const paragraphs = pageText.split(/\r?\n\r?\n/);
        for (let p of paragraphs) {
            const trimmed = p.trim();
            if (!trimmed) continue;

            const lines = trimmed.split(/\r?\n/);
            for (let line of lines) {
                const lineTrimmed = line.trim();
                if (!lineTrimmed) continue;

                blocks.push({
                    page: pageNum,
                    type: 'line',
                    text: lineTrimmed,
                    sourceIndex: sourceIndex++
                });
            }
        }
    }

    return {
        documentId,
        filename,
        type: 'pdf',
        pages: numPages,
        blocks
    };
};

/**
 * Main entry point to process an uploaded document.
 */
export const processDocument = async (file) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    
    if (ext === 'docx') {
        return processDocx(file.buffer, file.originalname);
    } else if (ext === 'pdf') {
        return processPdf(file.buffer, file.originalname);
    } else {
        return processTxt(file.buffer, file.originalname);
    }
};
