import { Request, Response } from 'express';
import { SearchService } from './search.service';

const searchService = new SearchService();

export class SearchController {
  async search(req: Request, res: Response) {
    try {
      const { type } = req.query;
      const user = (req as any).user;

      // Access Control: Only 'course' and 'university' searches are public
      const isPublicType = type === 'course' || type === 'university';

      if (!isPublicType && !user) {
        return res.status(401).json({ message: 'Authentication required for this search type' });
      }

      const results = await searchService.search(req.query, user);
      res.status(200).json(results);
    } catch (error: any) {
      console.error('Search failed:', error);
      res.status(500).json({ message: 'Search failed', error: error.message });
    }
  }
}
