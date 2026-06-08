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

  // Expanded Mapping from CCMAS Discipline to typical faculty/department names in DB
  const mapping: Record<string, string[]> = {
    "Administration and Management": ["Accounting", "Business Administration", "Public Administration", "Marketing", "Insurance", "Management"],
    "Agriculture": ["Agriculture", "Animal Science", "Soil Science", "Crop Science", "Fisheries", "Forestry"],
    "Allied Health Sciences": ["Nursing", "Physiotherapy", "Radiography", "Medical Laboratory", "Nutrition", "Dietetics"],
    "Architecture": ["Architecture"],
    "Arts": ["English", "History", "Philosophy", "Religious Studies", "Theatre Arts", "Music", "French", "Linguistics"],
    "Basic Medical Sciences": ["Anatomy", "Physiology", "Medical Biochemistry"],
    "Communication and Media Studies": ["Mass Communication", "Journalism", "Broadcasting", "Public Relations", "Advertising"],
    "Computing": ["Computer Science", "Information Technology", "Cyber Security", "Software Engineering", "Computer"],
    "Education": ["Education", "Adult Education", "Guidance and Counseling", "Special Education"],
    "Engineering": ["Civil Engineering", "Computer Engineering", "Electrical Engineering", "Mechanical Engineering", "Chemical Engineering", "Engineering"],
    "Environmental Sciences": ["Estate Management", "Quantity Surveying", "Urban and Regional Planning", "Building", "Environmental"],
    "Law": ["Law"],
    "Medicine and Dentistry": ["Medicine", "Surgery", "Dentistry"],
    "Pharmacy and Pharmaceutical Sciences": ["Pharmacy"],
    "Sciences": ["Biochemistry", "Biology", "Botany", "Chemistry", "Geology", "Mathematics", "Microbiology", "Physics", "Zoology", "Science"],
    "Social Sciences": ["Economics", "Geography", "Political Science", "Psychology", "Sociology", "Anthropology", "Social Science"],
    "Veterinary Medicine": ["Veterinary"]
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
          // Silently skip errors
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
