import { SearchService } from '../../src/modules/search/search.service';
import { typesenseService } from '../../src/shared/search/typesense.service';
import prisma from '../../src/config/db';

jest.mock('../../src/shared/search/typesense.service');
jest.mock('../../src/config/db', () => ({
  material: {
    findMany: jest.fn(),
  },
  question: {
    findMany: jest.fn(),
  },
  course: {
    findMany: jest.fn(),
  },
  university: {
    findMany: jest.fn(),
  },
}));

describe('SearchService', () => {
  let searchService: SearchService;
  const mockUser = { id: 'user-1', university: 'UNILAG' };

  beforeEach(() => {
    searchService = new SearchService();
    jest.clearAllMocks();
  });

  it('should call typesense search with correct parameters for materials', async () => {
    const mockResults = { hits: [], found: 0 };
    (typesenseService.search as jest.Mock).mockResolvedValue(mockResults);

    const query = { q: 'thermo', type: 'material', university: 'UNILAG' };
    await searchService.search(query, mockUser);

    expect(typesenseService.search).toHaveBeenCalledWith('materials', expect.objectContaining({
      q: 'thermo',
      filter_by: 'university:=UNILAG',
    }));
  });

  it('should fallback to Prisma when Typesense search fails', async () => {
    (typesenseService.search as jest.Mock).mockRejectedValue(new Error('Typesense down'));
    const mockPrismaResults = [{ id: 'mat-1', title: 'Thermo' }];
    (prisma.material.findMany as jest.Mock).mockResolvedValue(mockPrismaResults);

    const query = { q: 'thermo', type: 'material', university: 'UNILAG' };
    const result = await searchService.search(query, mockUser);

    expect(typesenseService.search).toHaveBeenCalled();
    expect(prisma.material.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([
          expect.objectContaining({ OR: expect.any(Array) }),
          expect.objectContaining({ university: 'UNILAG' })
        ])
      })
    }));

    expect(result.materials.hits).toHaveLength(1);
    expect(result.materials.hits[0].document.title).toBe('Thermo');
    expect(result.materials.found).toBe(1);
  });

  it('should handle cross-school browsing fallback when Typesense fails', async () => {
    (typesenseService.search as jest.Mock).mockRejectedValue(new Error('Typesense down'));
    (prisma.material.findMany as jest.Mock).mockResolvedValue([]);

    const query = { q: 'thermo', type: 'material' };
    await searchService.search(query, mockUser);

    // Should call Prisma twice: once for own university, once for others
    expect(prisma.material.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.material.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([
          expect.objectContaining({ university: 'UNILAG' })
        ])
      })
    }));
    expect(prisma.material.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([
          expect.objectContaining({ university: { not: 'UNILAG' } })
        ])
      })
    }));
  });
});
