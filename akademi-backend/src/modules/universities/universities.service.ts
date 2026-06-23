import prisma from '../../config/db';

export class UniversitiesService {
  async getAllUniversities(search?: string, limit?: number) {
    const query = typeof search === 'string' ? search.trim() : '';
    const take = Math.min(Math.max(Number(limit) || 50, 1), 100);

    return prisma.university.findMany({
      where: query
        ? { name: { contains: query, mode: 'insensitive' } }
        : undefined,
      orderBy: { name: 'asc' },
      take,
    });
  }

  async getFacultiesByUniversity(universityId: string) {
    const faculties = await prisma.department.groupBy({
      by: ['faculty'],
      where: { university_id: universityId },
      _count: { faculty: true },
      orderBy: { faculty: 'asc' },
    });

    return faculties.map((faculty) => ({
      name: faculty.faculty,
      departmentCount: faculty._count.faculty,
    }));
  }

  async getDepartmentsByUniversity(universityId: string, faculty?: string) {
    // Departments are not indexed separately but linked to universities in Prisma.
    // If we want cross-school browsing, we fetch from Prisma.
    return prisma.department.findMany({
      where: {
        university_id: universityId,
        ...(faculty ? { faculty } : {}),
      },
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
