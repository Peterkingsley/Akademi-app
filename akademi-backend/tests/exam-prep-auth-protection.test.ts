import express from 'express';
import request from 'supertest';
import examPrepRoutes from '../src/modules/exam-prep/exam-prep.routes';

describe('authenticated Exam Prep protection', () => {
  it('still rejects anonymous callers on the existing guided materials route', async () => {
    const app = express();
    app.use(express.json());
    app.use('/exam-prep', examPrepRoutes);

    const response = await request(app).get('/exam-prep/materials');
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Unauthorized' });
  });
});
