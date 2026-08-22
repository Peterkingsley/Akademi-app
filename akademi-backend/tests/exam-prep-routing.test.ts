import express, { RequestHandler } from 'express';
import request from 'supertest';

const mockGetGuidedMaterials = jest.fn((_req, res) => res.status(200).json([{ id: 'material-1' }]));
const mockGetGuidedSession = jest.fn((req, res) => res.status(200).json({ id: req.params.sessionId }));
const mockGetPlan = jest.fn((_req, res) => res.status(200).json({ source: 'legacy-plan' }));
const mockNoop = jest.fn((_req, res) => res.status(200).json({ ok: true }));

jest.mock('../src/modules/exam-prep/exam-prep.controller', () => ({
  ExamPrepController: jest.fn().mockImplementation(() => ({
    getGuidedMaterials: mockGetGuidedMaterials,
    startGuidedSession: mockNoop,
    getGuidedSession: mockGetGuidedSession,
    submitGuidedQuestion: mockNoop,
    advanceGuidedSession: mockNoop,
    getGuidedSummary: mockNoop,
    getCourseHub: mockNoop,
    startMockForCourse: mockNoop,
    upsertPlanSettings: mockNoop,
    createPlan: mockNoop,
    getPlans: mockNoop,
    getPlan: mockGetPlan,
    getReadiness: mockNoop,
    getMockHistory: mockNoop,
    startMock: mockNoop,
    getMockExam: mockNoop,
    submitMock: mockNoop,
    getMockResults: mockNoop,
  })),
}));

jest.mock('../src/modules/auth/auth.middleware', () => ({
  authenticate: ((_req, _res, next) => next()) as RequestHandler,
}));

jest.mock('../src/shared/middleware/rate-limit', () => ({
  generalAuthenticatedApiLimiter: ((_req, _res, next) => next()) as RequestHandler,
}));

import examPrepRoutes from '../src/modules/exam-prep/exam-prep.routes';

describe('Exam Prep route dispatch', () => {
  const app = express();
  app.use(express.json());
  app.use('/exam-prep', examPrepRoutes);

  beforeEach(() => jest.clearAllMocks());

  it('dispatches GET /exam-prep/materials to guided materials, never legacy getPlan', async () => {
    const response = await request(app).get('/exam-prep/materials');
    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: 'material-1' }]);
    expect(mockGetGuidedMaterials).toHaveBeenCalledTimes(1);
    expect(mockGetPlan).not.toHaveBeenCalled();
  });

  it('dispatches GET /exam-prep/sessions/:sessionId to guided session, never legacy getPlan', async () => {
    const response = await request(app).get('/exam-prep/sessions/some-session-id');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: 'some-session-id' });
    expect(mockGetGuidedSession).toHaveBeenCalledTimes(1);
    expect(mockGetPlan).not.toHaveBeenCalled();
  });

  it('does not treat an unknown named path as a legacy plan id', async () => {
    const response = await request(app).get('/exam-prep/future-feature');
    expect(response.status).toBe(404);
    expect(mockGetPlan).not.toHaveBeenCalled();
  });

  it('continues dispatching UUID plan ids to the legacy plan controller', async () => {
    const response = await request(app).get('/exam-prep/550e8400-e29b-41d4-a716-446655440000');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ source: 'legacy-plan' });
    expect(mockGetPlan).toHaveBeenCalledTimes(1);
    expect(mockGetGuidedMaterials).not.toHaveBeenCalled();
    expect(mockGetGuidedSession).not.toHaveBeenCalled();
  });
});
