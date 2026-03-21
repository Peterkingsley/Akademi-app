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
}
