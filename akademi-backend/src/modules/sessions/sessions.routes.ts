import { Router } from 'express';
import { SessionsController } from './sessions.controller';
import { authenticate } from '../auth/auth.middleware';
import multer from 'multer';
import {
  createRateLimiter,
  companionTurnRateLimiter,
  sessionCreationRateLimiter,
  sessionIngestRateLimiter,
  sessionMessageRateLimiter,
  voiceSessionRateLimiter,
} from '../../shared/middleware/rate-limit';

const router = Router();
const sessionsController = new SessionsController();
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
      return;
    }
    cb(new Error('Only image uploads are allowed'));
  },
});
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    const allowedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
      'application/json',
      'text/csv',
    ];
    const allowedExtensions = ['.pdf', '.docx', '.txt', '.md', '.markdown', '.json', '.csv'];

    if (
      allowedMimeTypes.includes(file.mimetype) ||
      allowedExtensions.some((extension) => name.endsWith(extension))
    ) {
      cb(null, true);
      return;
    }

    cb(new Error('Only PDF, DOCX, TXT, MD, JSON, and CSV uploads are allowed'));
  },
});
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
      return;
    }

    cb(new Error('Only audio uploads are allowed'));
  },
});

const sessionsGeneralRateLimiter = createRateLimiter({
  namespace: 'general-authenticated-sessions',
  windowMs: 15 * 60 * 1000,
  max: 150,
  strategy: 'hybrid',
});

router.use(authenticate);
router.use(sessionsGeneralRateLimiter);

router.post('/', sessionCreationRateLimiter, sessionsController.start);
router.post('/ingest/document', sessionIngestRateLimiter, documentUpload.single('document'), sessionsController.extractDocument);
router.post('/ingest/audio', sessionIngestRateLimiter, audioUpload.single('audio'), sessionsController.transcribeAudio);
router.post('/voice/tts', voiceSessionRateLimiter, sessionsController.synthesizeTutorSpeech);
router.post('/:id/voice/stream', voiceSessionRateLimiter, sessionsController.createTutorSpeechStream);
router.get('/:id/voice/stream-audio/:streamId', voiceSessionRateLimiter, sessionsController.streamTutorSpeech);
router.get('/', sessionsController.list);
router.get('/:id', sessionsController.getOne);
router.get('/:id/companion', sessionsController.getCompanionState);
router.get('/:id/visual-plan', sessionsController.getVisualPlan);
router.get('/:id/tutor-traces', sessionsController.listTutorTraces);
router.get('/:id/tutor-traces/summary', sessionsController.getTutorTraceSummary);
router.post('/:id/companion/start', companionTurnRateLimiter, sessionsController.startCompanion);
router.post('/:id/companion/message', companionTurnRateLimiter, sessionsController.sendCompanionMessage);
router.post('/:id/companion/turn', companionTurnRateLimiter, sessionsController.handleCompanionTurn);
router.patch('/:id/end', sessionsController.end);
router.get('/:id/messages', sessionsController.getMessages);
router.post('/:id/messages', sessionMessageRateLimiter, sessionsController.sendMessage);
router.post('/:id/messages/photo', sessionMessageRateLimiter, photoUpload.single('photo'), sessionsController.sendPhotoMessage);
router.get('/:id/summary', sessionsController.getSummary);

export default router;
