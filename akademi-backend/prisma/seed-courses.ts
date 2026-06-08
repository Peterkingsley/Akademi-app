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

  const mapping: Record<string, string[]> = {
    "Computing": ["Computer Science", "Information Technology", "Cyber Security", "Software Engineering", "Computing"],
    "Sciences": ["Biochemistry", "Biology", "Botany", "Chemistry", "Geology", "Mathematics", "Microbiology", "Physics", "Zoology", "Science", "Statistics"],
    "Social Sciences": ["Economics", "Geography", "Political Science", "Psychology", "Sociology", "Social Science", "Mass Communication", "Public Administration", "International Relations"],
    "Engineering": ["Civil Engineering", "Computer Engineering", "Electrical Engineering", "Mechanical Engineering", "Engineering", "Chemical Engineering", "Petroleum Engineering"],
    "Law": ["Law"],
    "Agriculture": ["Agriculture", "Animal Science", "Soil Science", "Crop Science", "Fisheries", "Forestry"],
    "Architecture": ["Architecture"],
    "Arts": ["History", "English", "Philosophy", "Religious Studies", "Linguistics", "Theatre Arts", "Music", "French", "Arabic", "Fine Arts", "Arts"],
    "Basic Medical Sciences": ["Anatomy", "Physiology", "Medical Biochemistry"],
    "Communication and Media Studies": ["Mass Communication", "Journalism", "Public Relations", "Advertising", "Media Studies"],
    "Education": ["Education", "Guidance and Counselling"],
    "Environmental Sciences": ["Environmental Science", "Estate Management", "Quantity Surveying", "Urban and Regional Planning", "Surveying", "Building"],
    "Medicine and Dentistry": ["Medicine", "Surgery", "Dentistry"],
    "Pharmacy": ["Pharmacy"],
    "Veterinary Medicine": ["Veterinary"]
  };

  for (const [discipline, courses] of Object.entries(ccmasData)) {
    const deptKeywords = mapping[discipline] || [discipline];
    console.log(`Seeding courses for discipline: ${discipline}`);

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
