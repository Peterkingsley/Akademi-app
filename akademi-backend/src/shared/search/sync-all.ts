import prisma from '../../config/db';
import { addMaterialToIndex, addQuestionsToIndex, addCourseToIndex, syncUniversitiesAndDepartments } from './typesense.sync';
import { typesenseService } from './typesense.service';

export async function syncAllToTypesense() {
  console.log('Initializing collections...');
  await typesenseService.initCollections();

  console.log('Syncing universities...');
  await syncUniversitiesAndDepartments();

  console.log('Syncing materials...');
  const materials = await prisma.material.findMany();
  for (const m of materials) {
    await addMaterialToIndex(m.id);
  }

  console.log('Syncing courses from master table...');
  const courses = await prisma.course.findMany({
    include: {
      department: {
        include: {
          university: true
        }
      }
    }
  });

  for (const c of courses) {
     await addCourseToIndex(c.code, c.department.university.name, c.department.name);
  }

  console.log('Syncing questions...');
  const questions = await prisma.question.findMany();
  const questionIds = questions.map(q => q.id);
  if (questionIds.length > 0) {
    await addQuestionsToIndex(questionIds);
  }

  console.log('Sync complete.');
}
