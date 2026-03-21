import prisma from '../../config/db';

export class SearchService {
  async search(query: any) {
    const { q, type, university, department, course_code, level } = query;

    const results: any = {
      materials: [],
      questions: [],
      courses: []
    };

    if (!type || type === 'material') {
      results.materials = await prisma.material.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { course_code: { contains: q, mode: 'insensitive' } },
          ],
          university: university || undefined,
          department: department || undefined,
          course_code: course_code || undefined,
          level: level ? parseInt(level) : undefined,
        },
        take: 20,
      });
    }

    if (!type || type === 'question') {
      results.questions = await prisma.question.findMany({
        where: {
          question_text: { contains: q, mode: 'insensitive' },
          course_code: course_code || undefined,
          department: department || undefined,
          level: level ? parseInt(level) : undefined,
        },
        take: 20,
      });
    }

    // "Courses" are represented by unique course_codes in materials or questions
    if (!type || type === 'course') {
      const materialsWithCourses = await prisma.material.findMany({
        where: {
          course_code: { contains: q, mode: 'insensitive' },
          university: university || undefined,
          department: department || undefined,
        },
        select: { course_code: true, department: true },
        distinct: ['course_code'],
        take: 20,
      });
      results.courses = materialsWithCourses;
    }

    return results;
  }
}
