import * as pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

async function extractPdfText(buffer: Buffer) {
  const parserModule = pdfParse as any;
  const parse = parserModule.default || parserModule;

  if (typeof parse === 'function') {
    const data = await parse(buffer);
    return data.text || '';
  }

  if (typeof parserModule.PDFParse === 'function') {
    const parser = new parserModule.PDFParse({ data: buffer });
    const data = await parser.getText();
    await parser.destroy?.();
    return data.text || '';
  }

  throw new Error('PDF parser is not available');
}

export async function extractDisciplineDocumentText(file: Express.Multer.File) {
  const name = file.originalname.toLowerCase();
  const mime = file.mimetype;

  if (mime === 'application/pdf' || name.endsWith('.pdf')) {
    return extractPdfText(file.buffer);
  }

  if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  ) {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value || '';
  }

  if (
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    name.endsWith('.txt') ||
    name.endsWith('.md') ||
    name.endsWith('.markdown') ||
    name.endsWith('.json') ||
    name.endsWith('.csv')
  ) {
    return file.buffer.toString('utf8');
  }

  throw new Error('Unsupported document type. Upload PDF, DOCX, TXT, MD, JSON, or CSV.');
}
