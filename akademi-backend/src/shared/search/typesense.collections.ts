import { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

export const materialSchema: CollectionCreateSchema = {
  name: 'materials',
  fields: [
    { name: 'id', type: 'string' },
    { name: 'title', type: 'string' },
    { name: 'course_code', type: 'string', facet: true },
    { name: 'university', type: 'string', facet: true },
    { name: 'faculty', type: 'string', facet: true },
    { name: 'department', type: 'string', facet: true },
    { name: 'level', type: 'int32', facet: true },
    { name: 'verification_status', type: 'string', facet: true },
    { name: 'verified_at', type: 'int64', value: 0 }
  ],
  default_sorting_field: 'verified_at'
};

export const questionSchema: CollectionCreateSchema = {
  name: 'questions',
  fields: [
    { name: 'id', type: 'string' },
    { name: 'question_text', type: 'string' },
    { name: 'course_code', type: 'string', facet: true },
    { name: 'department', type: 'string', facet: true },
    { name: 'difficulty', type: 'string', facet: true },
    { name: 'level', type: 'int32', facet: true }
  ]
};

export const courseSchema: CollectionCreateSchema = {
  name: 'courses',
  fields: [
    { name: 'id', type: 'string' },
    { name: 'course_code', type: 'string', facet: true },
    { name: 'department', type: 'string', facet: true },
    { name: 'university', type: 'string', facet: true }
  ]
};

export const universitySchema: CollectionCreateSchema = {
  name: 'universities',
  fields: [
    { name: 'id', type: 'string' },
    { name: 'name', type: 'string', facet: true },
    { name: 'location', type: 'string', optional: true }
  ]
};
