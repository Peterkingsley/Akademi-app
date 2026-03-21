import { typesenseService } from '../../shared/search/typesense.service';

export class SearchService {
  async search(query: any, user: any) {
    const { q, type, university, department, course_code, level, difficulty } = query;

    const collections = type ? [this.mapTypeToCollection(type)] : ['materials', 'questions', 'courses'];
    const results: any = {};

    for (const collection of collections) {
      const searchParams: any = {
        q: q || '*',
        query_by: this.getQueryByFields(collection),
        filter_by: this.buildFilterString(query, collection),
        typo_tokens_threshold: 2,
      };

      if (collection === 'materials') {
        searchParams.sort_by = 'verification_status:asc,verified_at:desc';
      }

      // Handle default results if no university filter is provided (Cross-school browsing)
      if (collection === 'materials' && !university && user) {
        // This is a bit complex for a single Typesense query to "rank own university first"
        // without affecting the whole set.
        // We can use optional filters or just do two searches if needed,
        // but Typesense also supports 'pinned_hits' or just ranking by a field.
        // A better way is to use a multi_search or search with a filter that boosts own university.

        // Let's implement the two-search logic as suggested in ticket
        const ownFilter = this.buildFilterString({ ...query, university: user.university }, collection);
        const otherFilter = this.buildFilterString({ ...query, university: `!${user.university}` }, collection);

        const ownResults = await typesenseService.search(collection, { ...searchParams, filter_by: ownFilter });
        const otherResults = await typesenseService.search(collection, { ...searchParams, filter_by: otherFilter });

        results[collection] = {
          hits: [...(ownResults.hits || []), ...(otherResults.hits || [])],
          found: (ownResults.found || 0) + (otherResults.found || 0)
        };
        continue;
      }

      const searchResult = await typesenseService.search(collection, searchParams);
      results[collection] = searchResult;
    }

    return results;
  }

  private mapTypeToCollection(type: string): string {
    switch (type) {
      case 'material': return 'materials';
      case 'question': return 'questions';
      case 'course': return 'courses';
      case 'university': return 'universities';
      default: return 'materials';
    }
  }

  private getQueryByFields(collection: string): string {
    switch (collection) {
      case 'materials': return 'title,course_code';
      case 'questions': return 'question_text,course_code';
      case 'courses': return 'course_code';
      case 'universities': return 'name';
      default: return 'title';
    }
  }

  private buildFilterString(query: any, collection: string): string {
    const filters: string[] = [];
    const { university, department, course_code, level, difficulty, verification_status } = query;

    if (university) {
      if (university.startsWith('!')) {
        filters.push(`university:!=${university.substring(1)}`);
      } else {
        filters.push(`university:=${university}`);
      }
    }
    if (department) filters.push(`department:=${department}`);
    if (course_code) filters.push(`course_code:=${course_code}`);
    if (level) filters.push(`level:=${level}`);
    if (difficulty && collection === 'questions') filters.push(`difficulty:=${difficulty}`);
    if (verification_status && collection === 'materials') filters.push(`verification_status:=${verification_status}`);

    return filters.join(' && ');
  }
}
