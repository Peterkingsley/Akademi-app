import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { syncUniversitiesAndDepartments } from '../src/shared/search/typesense.sync';

const prisma = new PrismaClient();

async function main() {
  const jsonPath = path.join(__dirname, './data/nigerian_tertiary_master.json');

  if (!fs.existsSync(jsonPath)) {
    console.error('JSON data file not found at:', jsonPath);
    return;
  }

  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const institutions = JSON.parse(rawData);

  console.log(`Importing ${institutions.length} institutions into Database...`);

  for (const inst of institutions) {
    try {
      // Upsert University
      const university = await prisma.university.upsert({
        where: { name: inst.institution },
        update: {},
        create: {
          name: inst.institution,
          location: 'Nigeria',
        },
      });

      for (const faculty of inst.faculties) {
        for (const course of faculty.courses) {
          // Upsert Department
          await prisma.department.upsert({
            where: {
              name_university_id: {
                name: course.course_name,
                university_id: university.id,
              },
            },
            update: {
              faculty: faculty.faculty_name,
            },
            create: {
              name: course.course_name,
              university_id: university.id,
              faculty: faculty.faculty_name,
            },
          });
        }
      }
    } catch (error) {
      console.error(`Failed to seed ${inst.institution}:`, error);
    }
  }

  console.log('Database seeding completed.');

  try {
    console.log('Syncing to Typesense...');
    await syncUniversitiesAndDepartments();
    console.log('Typesense sync completed.');
  } catch (error) {
    console.warn('Typesense sync failed (likely service unreachable), but DB is ready:', error);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
