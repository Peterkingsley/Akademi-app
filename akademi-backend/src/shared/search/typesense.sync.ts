import prisma from '../../config/db';
import { typesenseService } from './typesense.service';
import { MaterialDocument, QuestionDocument, CourseDocument, UniversityDocument } from './typesense.types';

export async function addMaterialToIndex(materialId: string) {
  const material = await prisma.material.findUnique({
    where: { id: materialId },
  });

  if (!material) return;

  const doc: MaterialDocument = {
    id: material.id,
    title: material.title,
    course_code: material.course_code,
    university: material.university,
    faculty: material.faculty,
    department: material.department,
    level: material.level,
    verification_status: material.verification_status,
    verified_at: material.verified_at ? Math.floor(material.verified_at.getTime() / 1000) : undefined,
  };

  await typesenseService.upsertDocument('materials', doc);
}

export async function removeMaterialFromIndex(materialId: string) {
  await typesenseService.deleteDocument('materials', materialId);
}

export async function addQuestionsToIndex(questionIds: string[]) {
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
  });

  for (const q of questions) {
    const doc: QuestionDocument = {
      id: q.id,
      question_text: q.question_text,
      course_code: q.course_code,
      department: q.department,
      difficulty: q.difficulty,
      level: q.level,
    };
    await typesenseService.upsertDocument('questions', doc);
  }
}

export async function addCourseToIndex(courseCode: string, university: string, department: string) {
  const id = `${university}_${department}_${courseCode}`.replace(/\s+/g, '_');
  const doc: CourseDocument = {
    id,
    course_code: courseCode,
    university,
    department,
  };
  await typesenseService.upsertDocument('courses', doc);
}

export async function syncUniversitiesAndDepartments() {
  const universities = await prisma.university.findMany();

  for (const uni of universities) {
    const uniDoc: UniversityDocument = {
      id: uni.id,
      name: uni.name,
      location: uni.location || undefined,
    };
    await typesenseService.upsertDocument('universities', uniDoc);
  }
}
