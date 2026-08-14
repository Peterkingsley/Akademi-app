const findMany = jest.fn();
const update = jest.fn();
const add = jest.fn();

jest.mock('../src/config/db', () => ({
  __esModule: true,
  default: {
    material: { findMany, update },
  },
}));

jest.mock('../src/config/queue', () => ({
  JOB_NAMES: {
    INGEST_MATERIAL: 'INGEST_MATERIAL',
    ASSEMBLE_CHUNKS: 'ASSEMBLE_CHUNKS',
    GENERATE_QUESTIONS: 'GENERATE_QUESTIONS',
  },
  systemQueue: { add },
  getQueueHealth: () => ({ activeBackgroundJobs: 0, queuedBackgroundJobs: 0 }),
}));

import {
  recoverPendingMaterials,
  recoverQuestionBanks,
} from '../src/modules/materials/material-processing';

describe('question-bank recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    update.mockResolvedValue({});
    add.mockResolvedValue(undefined);
  });

  it('queues extracted old and new materials for question generation without approval', async () => {
    findMany.mockResolvedValue([{ id: 'pending-material' }, { id: 'verified-material' }]);

    await recoverQuestionBanks();

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        content: { not: null },
        verification_status: { in: ['PENDING', 'VERIFIED'] },
      }),
    }));
    expect(add).toHaveBeenNthCalledWith(1, 'GENERATE_QUESTIONS', { materialId: 'pending-material' });
    expect(add).toHaveBeenNthCalledWith(2, 'GENERATE_QUESTIONS', { materialId: 'verified-material' });
  });

  it('re-ingests old verified materials whose extracted content is missing', async () => {
    findMany.mockResolvedValue([{ id: 'old-material', upload_chunks: [] }]);

    await recoverPendingMaterials();

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        content: null,
        verification_status: { in: ['PENDING', 'VERIFIED'] },
      }),
    }));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'old-material' } }));
    expect(add).toHaveBeenCalledWith('INGEST_MATERIAL', { materialId: 'old-material' });
  });
});
