import prisma from '../../config/db';

export class UniversitiesService {
  async getAllUniversities() {
    return prisma.university.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async getDepartmentsByUniversity(universityId: string) {
    return prisma.department.findMany({
      where: { university_id: universityId },
      orderBy: { name: 'asc' },
    });
  }
}
