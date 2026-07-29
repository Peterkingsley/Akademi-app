import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import prisma from '../config/db';
import { config } from '../config/env';
import { aiProvider } from '../modules/ai/ai.provider';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${config.r2AccountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.r2AccessKey,
    secretAccessKey: config.r2SecretKey,
  },
});

async function main() {
  const material = await prisma.material.findFirst({
    where: { title: { contains: 'MTH 102 LECTURE 1', mode: 'insensitive' } },
    select: { id: true, title: true, file_ref: true, file_type: true },
  });

  if (!material) {
    console.log('MATERIAL_NOT_FOUND');
    process.exit(1);
  }
  console.log('MATERIAL_FOUND:', JSON.stringify(material));

  const command = new GetObjectCommand({ Bucket: config.r2BucketName, Key: material.file_ref });
  const response = await s3Client.send(command);
  const body = await response.Body?.transformToByteArray();
  if (!body) throw new Error('Failed to download material file');
  const buffer = Buffer.from(body);
  console.log('DOWNLOADED_BYTES:', buffer.length);

  // Exact same call as extractPdfTextWithGemini() in ingestMaterial.job.ts (that function is not
  // exported, so replicated here verbatim to exercise the real generateMultimodalResponse -> Vertex
  // path without touching the material's processing_status via the job's claim mechanism).
  const text = await aiProvider.generateMultimodalResponse(
    [
      {
        text: `Extract all text from this PDF document.
Important rules:
- Preserve ALL mathematical formulas exactly, writing them in LaTeX notation wrapped in \\( \\) for inline math or \\[ \\] for display math
- For example: if you see F = ma, write it as \\(F = ma\\)
- If you see a fraction, use LaTeX: \\(\\frac{numerator}{denominator}\\)
- If you see superscripts like v², write \\(v^2\\)
- If you see subscripts like a₁, write \\(a_1\\)
- Preserve all headings, paragraphs, bullet points, and tables
- Output plain text with LaTeX math notation only - no markdown, no HTML`,
      },
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: buffer.toString('base64'),
        },
      },
    ],
    { extendedTimeouts: true },
  );

  console.log('EXTRACTED_CHAR_COUNT:', text.length);
  const latexCount = (text.match(/\\\(|\\\[/g) || []).length;
  console.log('LATEX_DELIMITER_COUNT:', latexCount);
  console.log('FIRST_300_CHARS:', JSON.stringify(text.slice(0, 300)));
  console.log('LAST_300_CHARS:', JSON.stringify(text.slice(-300)));
}

main()
  .catch((err) => {
    console.error('SCRIPT_ERROR:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
