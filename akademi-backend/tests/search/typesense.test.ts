import { typesenseService } from '../../src/shared/search/typesense.service';
import { typesenseClient } from '../../src/shared/search/typesense.client';

describe('Typesense Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize collections', async () => {
    const spyRetrieve = jest.spyOn(typesenseClient.collections('materials'), 'retrieve').mockRejectedValue({ httpStatus: 404 });
    const spyCreate = jest.spyOn(typesenseClient.collections(), 'create').mockResolvedValue({} as any);

    // Mocking other retrieve calls as well
    jest.spyOn(typesenseClient.collections('questions'), 'retrieve').mockRejectedValue({ httpStatus: 404 });
    jest.spyOn(typesenseClient.collections('courses'), 'retrieve').mockRejectedValue({ httpStatus: 404 });
    jest.spyOn(typesenseClient.collections('universities'), 'retrieve').mockRejectedValue({ httpStatus: 404 });

    await typesenseService.initCollections();

    expect(spyCreate).toHaveBeenCalledTimes(4);
  });

  it('should search materials', async () => {
    const mockResults = { hits: [{ document: { id: '1', title: 'Maths' } }], found: 1 };
    const spySearch = jest.spyOn(typesenseClient.collections('materials').documents(), 'search').mockResolvedValue(mockResults as any);

    const results = await typesenseService.search('materials', { q: 'Maths', query_by: 'title' });

    expect(results).toEqual(mockResults);
    expect(spySearch).toHaveBeenCalledWith({ q: 'Maths', query_by: 'title' });
  });
});
