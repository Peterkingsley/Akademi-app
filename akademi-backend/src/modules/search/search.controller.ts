import { Request, Response } from 'express';
import { SearchService } from './search.service';

const searchService = new SearchService();

export class SearchController {
  async search(req: Request, res: Response) {
    try {
      const results = await searchService.search(req.query);
      res.status(200).json(results);
    } catch (error) {
      res.status(500).json({ message: 'Search failed' });
    }
  }
}
