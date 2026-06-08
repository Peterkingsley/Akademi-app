import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const coursesPath = path.join(__dirname, '../../scraper/ccmas_courses.json');
  if (!fs.existsSync(coursesPath)) {
    console.error('CCMAS courses file not found.');
    return;
  }

  const ccmasData = JSON.parse(fs.readFileSync(coursesPath, 'utf-8'));

  // Mapping from CCMAS Discipline to typical faculty/department names in DB
  // This is a heuristic mapping
  const mapping: Record<string, string[]> = {
    "Computing": ["Computer Science", "Information Technology", "Cyber Security", "Software Engineering"],
    "Sciences": ["Biochemistry", "Biology", "Botany", "Chemistry", "Geology", "Mathematics", "Microbiology", "Physics", "Zoology", "Science"],
    "Social Sciences": ["Economics", "Geography", "Political Science", "Psychology", "Sociology", "Social Science"],
    "Engineering": ["Civil Engineering", "Computer Engineering", "Electrical Engineering", "Mechanical Engineering", "Engineering"],
    "Law": ["Law"],
    "Agriculture": ["Agriculture", "Animal Science", "Soil Science", "Crop Science"]
  };

  for (const [discipline, courses] of Object.entries(ccmasData)) {
    const deptKeywords = mapping[discipline] || [discipline];
    console.log(`Seeding courses for discipline: ${discipline}`);

    // Find all departments that match any of the keywords
    const departments = await prisma.department.findMany({
      where: {
        OR: deptKeywords.map(keyword => ({
          name: { contains: keyword, mode: 'insensitive' }
        }))
      }
    });

    console.log(`Found ${departments.length} departments matching ${discipline}.`);

    for (const dept of departments) {
      console.log(`  Processing department: ${dept.name} at University ID: ${dept.university_id}`);
      for (const course of courses as any[]) {
        try {
          await prisma.course.upsert({
            where: {
              code_department_id: {
                code: course.code,
                department_id: dept.id,
              },
            },
            update: {
              name: course.name,
              level: course.level,
              credit_units: course.units,
            },
            create: {
              code: course.code,
              name: course.name,
              level: course.level,
              credit_units: course.units,
              department_id: dept.id,
            },
          });
        } catch (error) {
          // Silently skip errors (usually unique constraint or data issues)
        }
      }
    }
  }

  console.log('Course seeding completed.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
