declare module '@google-cloud/vision' {
  export class ImageAnnotatorClient {
    constructor(options?: { apiKey?: string });
    textDetection(request: unknown): Promise<any[]>;
    batchAnnotateFiles(request: unknown): Promise<any[]>;
  }
}

declare module 'typesense' {
  export class Client {
    constructor(options: unknown);
    collections(name?: string): any;
  }
}

declare module 'typesense/lib/Typesense/Collections' {
  export interface CollectionCreateSchema {
    name: string;
    fields: Array<Record<string, unknown>>;
    default_sorting_field?: string;
  }
}
