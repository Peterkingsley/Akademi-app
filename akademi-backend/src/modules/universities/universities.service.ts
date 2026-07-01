import prisma from '../../config/db';

type UniversitySearchCacheEntry = {
  expiresAt: number;
  data: Array<{ id: string; name: string; location: string | null; created_at: Date }>;
};

export class UniversitiesService {
  private universitySearchCache = new Map<string, UniversitySearchCacheEntry>();
  private readonly universitySearchCacheTtlMs = 60 * 1000;

  private getCachedUniversitySearch(cacheKey: string) {
    const cached = this.universitySearchCache.get(cacheKey);
    if (!cached) return null;

    if (cached.expiresAt <= Date.now()) {
      this.universitySearchCache.delete(cacheKey);
      return null;
    }

    return cached.data;
  }

  private setCachedUniversitySearch(
    cacheKey: string,
    data: Array<{ id: string; name: string; location: string | null; created_at: Date }>
  ) {
    this.universitySearchCache.set(cacheKey, {
      expiresAt: Date.now() + this.universitySearchCacheTtlMs,
      data,
    });

    if (this.universitySearchCache.size > 200) {
      const oldestKey = this.universitySearchCache.keys().next().value;
      if (oldestKey) {
        this.universitySearchCache.delete(oldestKey);
      }
    }
  }

  async getAllUniversities(search?: string, limit?: number) {
    const query = typeof search === 'string' ? search.trim() : '';
    const normalizedLimit = Number(limit);
    const take =
      Number.isFinite(normalizedLimit) && normalizedLimit > 0
        ? Math.min(Math.max(normalizedLimit, 1), 1000)
        : undefined;

    if (!query) {
      return prisma.university.findMany({
        orderBy: { name: 'asc' },
        take,
      });
    }

    const safeTake = take || 12;
    const normalizedQuery = query.toLowerCase();
    const cacheKey = `${normalizedQuery}:${safeTake}`;
    const cached = this.getCachedUniversitySearch(cacheKey);
    if (cached) {
      return cached;
    }

    const prefixMatches = await prisma.university.findMany({
      where: { name: { startsWith: query, mode: 'insensitive' } },
      orderBy: { name: 'asc' },
      take: safeTake,
    });

    let results = prefixMatches;

    if (results.length < safeTake) {
      const remaining = safeTake - results.length;
      const prefixIds = results.map((item) => item.id);
      const containsMatches = await prisma.university.findMany({
        where: {
          name: { contains: query, mode: 'insensitive' },
          ...(prefixIds.length ? { id: { notIn: prefixIds } } : {}),
        },
        orderBy: { name: 'asc' },
        take: remaining,
      });

      results = [...results, ...containsMatches];
    }

    this.setCachedUniversitySearch(cacheKey, results);
    return results;
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
