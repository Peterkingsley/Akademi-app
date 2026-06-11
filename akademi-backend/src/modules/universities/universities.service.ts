import prisma from '../../config/db';
import { typesenseService } from '../../shared/search/typesense.service';

export class UniversitiesService {
  async getAllUniversities() {
    // We can use Typesense for faster discovery or Prisma for source of truth.
    // The ticket asks for /universities to return all supported universities.
    // Using Typesense:
    try {
      const results = await typesenseService.search('universities', {
        q: '*',
        query_by: 'name',
        sort_by: 'name:asc',
      });
      return results.hits?.map((hit: any) => hit.document) || [];
    } catch (error) {
      // Fallback to Prisma if Typesense fails or is not initialized
      return prisma.university.findMany({
        orderBy: { name: 'asc' },
      });
    }
  }

  async getDepartmentsByUniversity(universityId: string) {
    // Departments are not indexed separately but linked to universities in Prisma.
    // If we want cross-school browsing, we fetch from Prisma.
    return prisma.department.findMany({
      where: { university_id: universityId },
      orderBy: { name: 'asc' },
    });
  }

  async getCourseSuggestions(departmentId: string, level?: number, semester?: number) {
    const normalizedLevel = level && Number.isFinite(level) ? level : undefined;
    const normalizedSemester = semester && [1, 2].includes(semester) ? semester : undefined;

    const [seededCourses, studentCourses] = await Promise.all([
      prisma.course.findMany({
        where: {
          department_id: departmentId,
          ...(normalizedLevel ? { level: normalizedLevel } : {}),
          ...(normalizedSemester ? { semester: normalizedSemester } : {}),
        },
        orderBy: [{ code: 'asc' }],
      }),
      prisma.studentCourse.groupBy({
        by: ['code', 'name', 'level', 'semester'],
        where: {
          department_id: departmentId,
          ...(normalizedLevel ? { level: normalizedLevel } : {}),
          ...(normalizedSemester ? { semester: normalizedSemester } : {}),
        },
        _count: { code: true },
        orderBy: [{ _count: { code: 'desc' } }, { code: 'asc' }],
        take: 50,
      }),
    ]);

    const merged = new Map<string, any>();

    for (const course of seededCourses) {
      merged.set(`${course.code}-${course.level}-${course.semester}`, {
        id: course.id,
        code: course.code,
        name: course.name,
        level: course.level,
        semester: course.semester,
        source: course.source || 'seeded',
        usageCount: 0,
      });
    }

    for (const course of studentCourses) {
      const key = `${course.code}-${course.level}-${course.semester}`;
      const existing = merged.get(key);
      merged.set(key, {
        id: existing?.id || key,
        code: course.code,
        name: existing?.name || course.name || null,
        level: course.level,
        semester: course.semester,
        source: existing ? 'seeded_and_crowdsourced' : 'crowdsourced',
        usageCount: course._count.code,
      });
    }

    return Array.from(merged.values()).sort((a, b) => {
      if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
      return a.code.localeCompare(b.code);
    });
  }
}
