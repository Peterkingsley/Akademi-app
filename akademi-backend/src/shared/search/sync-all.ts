import prisma from '../../config/db';
import { addMaterialToIndex, addQuestionsToIndex, addCourseToIndex, syncUniversitiesAndDepartments } from './typesense.sync';
import { typesenseService } from './typesense.service';

export async function syncAllToTypesense() {
  console.log('Initializing collections...');
  await typesenseService.initCollections();

  console.log('Syncing universities...');
  await syncUniversitiesAndDepartments();

  console.log('Syncing materials and courses...');
  const materials = await prisma.material.findMany();
  for (const m of materials) {
    await addMaterialToIndex(m.id);
    if (m.course_code) {
      await addCourseToIndex(m.course_code, m.university, m.department);
    }
  }

  console.log('Syncing questions...');
  const questions = await prisma.question.findMany();
  const questionIds = questions.map(q => q.id);
  if (questionIds.length > 0) {
    await addQuestionsToIndex(questionIds);
  }

  console.log('Sync complete.');
}
