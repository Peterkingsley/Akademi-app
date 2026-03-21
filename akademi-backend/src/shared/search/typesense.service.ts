import { typesenseClient } from './typesense.client';
import { materialSchema, questionSchema, courseSchema, universitySchema } from './typesense.collections';

export class TypesenseService {
  private static instance: TypesenseService;

  private constructor() {}

  public static getInstance(): TypesenseService {
    if (!TypesenseService.instance) {
      TypesenseService.instance = new TypesenseService();
    }
    return TypesenseService.instance;
  }

  async initCollections() {
    const schemas = [materialSchema, questionSchema, courseSchema, universitySchema];
    for (const schema of schemas) {
      try {
        await typesenseClient.collections(schema.name).retrieve();
        // console.log(`Collection ${schema.name} already exists.`);
      } catch (error: any) {
        if (error.status === 404 || error.httpStatus === 404) {
          await typesenseClient.collections().create(schema);
          console.log(`Collection ${schema.name} created.`);
        } else {
          throw error;
        }
      }
    }
  }

  async upsertDocument(collectionName: string, document: any) {
    return typesenseClient.collections(collectionName).documents().upsert(document);
  }

  async deleteDocument(collectionName: string, documentId: string) {
    return typesenseClient.collections(collectionName).documents(documentId).delete();
  }

  async search(collectionName: string, searchParams: any) {
    return typesenseClient.collections(collectionName).documents().search(searchParams);
  }
}

export const typesenseService = TypesenseService.getInstance();
