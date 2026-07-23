import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import puppeteer from 'puppeteer';
import prisma from '../../config/db';
import { config } from '../../config/env';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${config.r2AccountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.r2AccessKey,
    secretAccessKey: config.r2SecretKey,
  },
});

export class TextbookPdfService {
  /**
   * Generates a PDF for an Akademi-generated textbook and uploads it to R2/S3.
   * Caches the generated PDF URL to avoid re-generating.
   */
  async getOrGenerateTextbookPdf(materialId: string): Promise<{ url: string }> {
    const material = await prisma.material.findUnique({
      where: { id: materialId },
    });

    if (!material) {
      throw new Error('Material not found');
    }

    if (!material.is_akademi_generated) {
      throw new Error('Not an Akademi-generated textbook. Use getMaterialDownloadUrl instead.');
    }

    // 1. Check if we already generated it
    if (material.pdf_file_ref) {
      // Return presigned URL for existing PDF
      const command = new GetObjectCommand({
        Bucket: config.r2BucketName,
        Key: material.pdf_file_ref,
      });
      const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      return { url };
    }

    // 2. Generate PDF using Puppeteer
    const pdfBuffer = await this.generatePdfBuffer(material);

    // 3. Upload to R2/S3
    const pdfFileRef = `generated-textbooks/${material.id}-${Date.now()}.pdf`;
    
    await s3Client.send(
      new PutObjectCommand({
        Bucket: config.r2BucketName,
        Key: pdfFileRef,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
        ContentDisposition: `attachment; filename="${material.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`,
      })
    );

    // 4. Update the material with the new pdf_file_ref
    await prisma.material.update({
      where: { id: material.id },
      data: {
        pdf_file_ref: pdfFileRef,
        pdf_generated_at: new Date(),
      },
    });

    // 5. Return presigned URL
    const command = new GetObjectCommand({
      Bucket: config.r2BucketName,
      Key: pdfFileRef,
    });
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    return { url };
  }

  private async generatePdfBuffer(material: any): Promise<Buffer> {
    const readerStructure = material.reader_structure as any;
    let pagesHtml = '';

    if (readerStructure && Array.isArray(readerStructure.pages)) {
      let currentChapter = '';
      for (const page of readerStructure.pages) {
        if (page.chapterTitle !== currentChapter) {
          pagesHtml += `<h2 class="chapter-title">${page.chapterTitle}</h2>`;
          currentChapter = page.chapterTitle;
        }
        pagesHtml += `<h3 class="page-title">${page.pageTitle || ''}</h3>`;
        
        // Convert plain text content to paragraphs
        const paragraphs = (page.content || '')
          .split('\n')
          .filter((p: string) => p.trim() !== '')
          .map((p: string) => `<p>${p}</p>`)
          .join('');
          
        pagesHtml += `<div class="content-body">${paragraphs}</div>`;
      }
    } else {
      // Fallback to raw content if reader_structure is missing
      const paragraphs = (material.content || '')
        .split('\n')
        .filter((p: string) => p.trim() !== '')
        .map((p: string) => `<p>${p}</p>`)
        .join('');
      pagesHtml += `<div class="content-body">${paragraphs}</div>`;
    }

    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
          
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 40px;
          }
          .cover-page {
            height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            page-break-after: always;
          }
          .cover-title {
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 16px;
            color: #111;
          }
          .cover-subtitle {
            font-size: 18px;
            color: #666;
            margin-bottom: 8px;
          }
          .chapter-title {
            font-size: 24px;
            font-weight: 700;
            color: #111;
            margin-top: 40px;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #eee;
            page-break-before: always;
          }
          .page-title {
            font-size: 20px;
            font-weight: 600;
            color: #444;
            margin-top: 30px;
            margin-bottom: 15px;
          }
          p {
            margin-bottom: 16px;
            text-align: justify;
          }
        </style>
      </head>
      <body>
        <div class="cover-page">
          <div class="cover-title">${material.title}</div>
          <div class="cover-subtitle">${material.course_code || 'General Textbook'}</div>
          <div class="cover-subtitle">${material.university}</div>
        </div>
        ${pagesHtml}
      </body>
      </html>
    `;

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(htmlTemplate, { waitUntil: 'networkidle0' });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }
}

export const textbookPdfService = new TextbookPdfService();
