import { SearchService } from '../../src/modules/search/search.service';
import { typesenseService } from '../../src/shared/search/typesense.service';

jest.mock('../../src/shared/search/typesense.service');

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

  it('should handle cross-school browsing when no university is provided', async () => {
    (typesenseService.search as jest.Mock).mockResolvedValue({ hits: [], found: 0 });

    const query = { q: 'thermo', type: 'material' };
    await searchService.search(query, mockUser);

    // Should call search twice: once for own university, once for others
    expect(typesenseService.search).toHaveBeenCalledTimes(2);
    expect(typesenseService.search).toHaveBeenNthCalledWith(1, 'materials', expect.objectContaining({
      filter_by: 'university:=UNILAG',
    }));
    expect(typesenseService.search).toHaveBeenNthCalledWith(2, 'materials', expect.objectContaining({
      filter_by: 'university:!=UNILAG',
    }));
  });
});
