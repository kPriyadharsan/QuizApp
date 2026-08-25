import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

console.log('PDFParse class:', PDFParse);

// Create a basic PDF buffer with a dummy text block
const minimalPdfBuffer = Buffer.from(
    '%PDF-1.4\n' +
    '1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n' +
    '2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n' +
    '3 0 obj <</Type /Page /Parent 2 0 R /Resources <<>> /MediaBox [0 0 612 792] /Contents 4 0 R>> endobj\n' +
    '4 0 obj <</Length 44>> stream\n' +
    'BT /F1 12 Tf 72 712 Td (1. Test Question?) Tj ET\n' +
    'endstream endobj\n' +
    'xref\n' +
    '0 5\n' +
    '0000000000 65535 f\n' +
    '0000000009 00000 n\n' +
    '0000000056 00000 n\n' +
    '0000000111 00000 n\n' +
    '0000000212 00000 n\n' +
    'trailer <</Size 5 /Root 1 0 R>>\n' +
    'startxref\n' +
    '306\n' +
    '%%EOF'
);

async function run() {
    try {
        const parser = new PDFParse({ data: minimalPdfBuffer });
        console.log('Parser instance:', parser);
        const pdfData = await parser.getText();
        console.log('pdfData returned:', pdfData);
    } catch (err) {
        console.error('Error during test:', err);
    }
}

run();
