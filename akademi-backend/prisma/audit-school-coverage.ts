import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const PLACEHOLDER_FACULTIES = new Set(['General Studies', 'Technical and Vocational Studies', 'Education']);
const PLACEHOLDER_DEPARTMENTS = new Set(['General Studies', 'General Technical Studies', 'General Education']);

type Status = 'complete' | 'needs_enrichment' | 'placeholder_only' | 'missing_departments';

function csvEscape(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function assessSchool(departments: Array<{ name: string; faculty: string }>) {
  const departmentCount = departments.length;
  const faculties = new Set(departments.map((department) => department.faculty).filter(Boolean));
  const placeholderDepartmentCount = departments.filter((department) => PLACEHOLDER_DEPARTMENTS.has(department.name)).length;
  const placeholderFacultyCount = departments.filter((department) => PLACEHOLDER_FACULTIES.has(department.faculty)).length;
  const hasPlaceholderDepartment = placeholderDepartmentCount > 0;
  const hasPlaceholderFaculty = placeholderFacultyCount > 0;
  const isPlaceholderOnly = departmentCount > 0 && placeholderDepartmentCount === departmentCount;

  let status: Status = 'complete';
  let recommendedAction = 'Keep monitoring and refresh against official school sources periodically.';

  if (departmentCount === 0) {
    status = 'missing_departments';
    recommendedAction = 'Add faculties and departments from the school website or regulator programme list.';
  } else if (isPlaceholderOnly) {
    status = 'placeholder_only';
    recommendedAction = 'Replace placeholder faculty/department with real faculties and departments.';
  } else if (departmentCount <= 1 || faculties.size <= 1 || hasPlaceholderDepartment || hasPlaceholderFaculty) {
    status = 'needs_enrichment';
    recommendedAction = 'Review this school for missing faculties/departments and merge in verified data.';
  }

  return {
    departmentCount,
    facultyCount: faculties.size,
    hasPlaceholderDepartment,
    hasPlaceholderFaculty,
    isPlaceholderOnly,
    status,
    recommendedAction,
  };
}

function parseArgs() {
  const outputArg = process.argv.find((arg) => arg.startsWith('--output='));
  const formatArg = process.argv.find((arg) => arg.startsWith('--format='));

  return {
    outputPath: outputArg?.replace('--output=', ''),
    format: formatArg?.replace('--format=', '') === 'csv' ? 'csv' : 'json',
    incompleteOnly: process.argv.includes('--incomplete-only'),
  };
}

async function main() {
  const options = parseArgs();
  const universities = await prisma.university.findMany({
    include: {
      departments: {
        select: { name: true, faculty: true },
        orderBy: [{ faculty: 'asc' }, { name: 'asc' }],
      },
    },
    orderBy: { name: 'asc' },
  });

  const schools = universities.map((university) => ({
    id: university.id,
    name: university.name,
    location: university.location,
    ...assessSchool(university.departments),
  }));

  const summary = schools.reduce(
    (acc, school) => {
      acc.totalSchools += 1;
      acc.totalDepartments += school.departmentCount;
      acc.totalFaculties += school.facultyCount;
      if (school.status === 'complete') acc.completeSchools += 1;
      if (school.status === 'needs_enrichment') acc.needsEnrichmentSchools += 1;
      if (school.status === 'placeholder_only') acc.placeholderOnlySchools += 1;
      if (school.status === 'missing_departments') acc.missingDepartmentSchools += 1;
      if (school.departmentCount <= 1) acc.lowDepartmentSchools += 1;
      return acc;
    },
    {
      totalSchools: 0,
      completeSchools: 0,
      needsEnrichmentSchools: 0,
      placeholderOnlySchools: 0,
      missingDepartmentSchools: 0,
      lowDepartmentSchools: 0,
      totalDepartments: 0,
      totalFaculties: 0,
    }
  );

  const rows = options.incompleteOnly ? schools.filter((school) => school.status !== 'complete') : schools;
  const payload = {
    generatedAt: new Date().toISOString(),
    summary: {
      ...summary,
      incompleteSchools: schools.filter((school) => school.status !== 'complete').length,
    },
    schools: rows,
  };

  const output = options.format === 'csv'
    ? [
        ['name', 'location', 'status', 'departmentCount', 'facultyCount', 'hasPlaceholderDepartment', 'hasPlaceholderFaculty', 'recommendedAction'].join(','),
        ...rows.map((school) =>
          [
            school.name,
            school.location,
            school.status,
            school.departmentCount,
            school.facultyCount,
            school.hasPlaceholderDepartment,
            school.hasPlaceholderFaculty,
            school.recommendedAction,
          ]
            .map(csvEscape)
            .join(',')
        ),
      ].join('\n')
    : JSON.stringify(payload, null, 2);

  if (options.outputPath) {
    const resolvedPath = path.resolve(process.cwd(), options.outputPath);
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    fs.writeFileSync(resolvedPath, output);
    console.log(`School coverage audit written to ${resolvedPath}`);
  } else {
    console.log(output);
  }
}

main()
  .catch((error) => {
    console.error('Failed to audit school coverage:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
