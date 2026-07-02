import fs from 'fs';
import path from 'path';
import { getUniversityCoverageAudit } from '../src/modules/universities/university-coverage';

function escapeCsv(value: unknown) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const writeFiles = args.has('--write');
  const outputDir = path.resolve(process.cwd(), 'prisma/output');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  const audit = await getUniversityCoverageAudit();

  console.log(JSON.stringify(audit.summary, null, 2));

  if (!writeFiles) {
    console.log('Run with --write to export JSON and CSV reports.');
    return;
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, `school-coverage-audit-${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(audit, null, 2), 'utf-8');

  const csvHeaders = [
    'id',
    'name',
    'location',
    'sourceCategory',
    'schoolType',
    'facultyCount',
    'departmentCount',
    'placeholderFacultyCount',
    'placeholderDepartmentCount',
    'hasPlaceholderFaculty',
    'hasPlaceholderDepartment',
    'status',
    'recommendedAction',
  ];

  const csvRows = [
    csvHeaders.join(','),
    ...audit.items.map((item) =>
      [
        item.id,
        item.name,
        item.location || '',
        item.sourceCategory,
        item.schoolType,
        item.facultyCount,
        item.departmentCount,
        item.placeholderFacultyCount,
        item.placeholderDepartmentCount,
        item.hasPlaceholderFaculty,
        item.hasPlaceholderDepartment,
        item.status,
        item.recommendedAction,
      ]
        .map(escapeCsv)
        .join(',')
    ),
  ];

  const csvPath = path.join(outputDir, `school-coverage-audit-${timestamp}.csv`);
  fs.writeFileSync(csvPath, csvRows.join('\n'), 'utf-8');

  console.log(`Wrote audit files:\n- ${jsonPath}\n- ${csvPath}`);
}

main().catch((error) => {
  console.error('Failed to audit school coverage:', error);
  process.exit(1);
});
