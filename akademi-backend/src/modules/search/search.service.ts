import { typesenseService } from '../../shared/search/typesense.service';
import prisma from '../../config/db';

export class SearchService {
  async search(query: any, user: any) {
    const { q, type, university, department, course_code, level, difficulty } = query;

    const collections = type ? [this.mapTypeToCollection(type)] : ['materials', 'questions', 'courses'];
    const results: any = {};

    for (const collection of collections) {
      try {
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
      } catch (error) {
        console.error(`Typesense search failed for collection ${collection}, falling back to Prisma:`, error);

        if (collection === 'materials' && !university && user) {
           const ownResults = await this.prismaSearch(collection, { ...query, university: user.university });
           const otherResults = await this.prismaSearch(collection, { ...query, university: `!${user.university}` });

           results[collection] = {
             hits: [...(ownResults.hits || []), ...(otherResults.hits || [])],
             found: (ownResults.found || 0) + (otherResults.found || 0)
           };
        } else {
           results[collection] = await this.prismaSearch(collection, query);
        }
      }
    }

    return results;
  }

  private async prismaSearch(collection: string, query: any) {
    const { q, university, department, course_code, level, difficulty, verification_status } = query;
    const searchStr = q && q !== '*' ? q : '';
    let items: any[] = [];

    const buildWhere = (coll: string, qry: any) => {
      const { university, department, course_code, level, difficulty, verification_status } = qry;
      const andFilters: any[] = [];

      if (searchStr) {
        if (coll === 'materials') {
          andFilters.push({ OR: [{ title: { contains: searchStr, mode: 'insensitive' } }, { course_code: { contains: searchStr, mode: 'insensitive' } }] });
        } else if (coll === 'questions') {
          andFilters.push({ OR: [{ question_text: { contains: searchStr, mode: 'insensitive' } }, { course_code: { contains: searchStr, mode: 'insensitive' } }] });
        } else if (coll === 'courses') {
          andFilters.push({ code: { contains: searchStr, mode: 'insensitive' } });
        } else if (coll === 'universities') {
          andFilters.push({ name: { contains: searchStr, mode: 'insensitive' } });
        }
      }

      if (university) {
        if (university.startsWith('!')) {
          const uniName = university.substring(1);
          if (coll === 'courses') {
            andFilters.push({ department: { university: { name: { not: uniName } } } });
          } else if (coll === 'universities') {
            andFilters.push({ name: { not: uniName } });
          } else {
            andFilters.push({ university: { not: uniName } });
          }
        } else {
          if (coll === 'courses') {
            andFilters.push({ department: { university: { name: university } } });
          } else if (coll === 'universities') {
            andFilters.push({ name: university });
          } else {
            andFilters.push({ university });
          }
        }
      }

      if (department) {
        if (coll === 'courses') {
          andFilters.push({ department: { name: department } });
        } else {
          andFilters.push({ department });
        }
      }

      if (course_code) andFilters.push({ course_code });
      if (level) andFilters.push({ level: parseInt(level.toString()) });
      if (difficulty && coll === 'questions') andFilters.push({ difficulty });
      if (verification_status && coll === 'materials') andFilters.push({ verification_status });

      return { AND: andFilters };
    };

    switch (collection) {
      case 'materials':
        items = await prisma.material.findMany({
          where: buildWhere('materials', query),
          orderBy: [
            { verification_status: 'asc' },
            { created_at: 'desc' }
          ]
        });
        break;
      case 'questions':
        items = await prisma.question.findMany({
          where: buildWhere('questions', query)
        });
        break;
      case 'courses':
        items = await prisma.course.findMany({
          where: buildWhere('courses', query),
          include: {
            department: {
              include: {
                university: true
              }
            }
          }
        });
        // Flatten to match Typesense schema
        items = items.map(c => ({
          ...c,
          university: c.department.university.name,
          department: c.department.name
        }));
        break;
      case 'universities':
        items = await prisma.university.findMany({
          where: buildWhere('universities', query),
          orderBy: { name: 'asc' }
        });
        break;
    }

    return {
      hits: items.map(item => ({ document: item })),
      found: items.length
    };
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
