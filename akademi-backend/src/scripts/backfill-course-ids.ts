import prisma from '../config/db';
import { resolveDepartmentId, findOrCreateCourse } from '../shared/utils/department-resolver';

const BATCH_SIZE = 200;

type Summary = { resolved: number; unresolved: number };

async function resolveCourseId(university: string | null, department: string | null, level: number, courseCode: string) {
  if (!university || !department) return null;
  const departmentId = await resolveDepartmentId(university, department);
  if (!departmentId) return null;
  const course = await findOrCreateCourse({ departmentId, code: courseCode, level });
  return course.id;
}

async function backfillMaterials(): Promise<Summary> {
  const summary: Summary = { resolved: 0, unresolved: 0 };
  let cursor: string | undefined;

  for (;;) {
    const rows = await prisma.material.findMany({
      where: { course_id: null, course_code: { not: null } },
      select: { id: true, course_code: true, university: true, department: true, level: true },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      const courseId = await resolveCourseId(row.university, row.department, row.level, row.course_code!);
      if (courseId) {
        await prisma.material.update({ where: { id: row.id }, data: { course_id: courseId } });
        summary.resolved += 1;
      } else {
        summary.unresolved += 1;
      }
    }

    cursor = rows[rows.length - 1].id;
    if (rows.length < BATCH_SIZE) break;
  }

  return summary;
}

async function backfillQuestions(): Promise<Summary> {
  const summary: Summary = { resolved: 0, unresolved: 0 };
  let cursor: string | undefined;

  for (;;) {
    const rows = await prisma.question.findMany({
      where: { course_id: null, course_code: { not: null } },
      select: { id: true, course_code: true, university: true, department: true, level: true },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      const courseId = await resolveCourseId(row.university, row.department, row.level, row.course_code!);
      if (courseId) {
        await prisma.question.update({ where: { id: row.id }, data: { course_id: courseId } });
        summary.resolved += 1;
      } else {
        summary.unresolved += 1;
      }
    }

    cursor = rows[rows.length - 1].id;
    if (rows.length < BATCH_SIZE) break;
  }

  return summary;
}

async function backfillExamPrepPlans(): Promise<Summary> {
  const summary: Summary = { resolved: 0, unresolved: 0 };
  let cursor: string | undefined;

  for (;;) {
    const rows = await prisma.examPrepPlan.findMany({
      where: { course_id: null, course_code: { not: null } },
      select: { id: true, course_code: true, user: { select: { university: true, department: true, level: true } } },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      const courseId = await resolveCourseId(row.user.university, row.user.department, row.user.level, row.course_code!);
      if (courseId) {
        await prisma.examPrepPlan.update({ where: { id: row.id }, data: { course_id: courseId } });
        summary.resolved += 1;
      } else {
        summary.unresolved += 1;
      }
    }

    cursor = rows[rows.length - 1].id;
    if (rows.length < BATCH_SIZE) break;
  }

  return summary;
}

async function main() {
  console.log('Backfilling Material.course_id...');
  const materials = await backfillMaterials();
  console.log(`  resolved=${materials.resolved} unresolved=${materials.unresolved}`);

  console.log('Backfilling Question.course_id...');
  const questions = await backfillQuestions();
  console.log(`  resolved=${questions.resolved} unresolved=${questions.unresolved}`);

  console.log('Backfilling ExamPrepPlan.course_id...');
  const plans = await backfillExamPrepPlans();
  console.log(`  resolved=${plans.resolved} unresolved=${plans.unresolved}`);

  console.log('\nSummary:');
  console.log(JSON.stringify({ materials, questions, plans }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
