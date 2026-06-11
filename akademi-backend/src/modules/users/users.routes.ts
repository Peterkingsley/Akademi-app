import { Router } from 'express';
import multer from 'multer';
import { UsersController } from './users.controller';
import { authenticate } from '../auth/auth.middleware';

const router = Router();
const usersController = new UsersController();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Only JPG and PNG files are allowed'));
    }
  },
});

router.use(authenticate);

router.get('/me', usersController.getMe);
router.patch('/me', usersController.updateMe);
router.patch('/me/photo', upload.single('photo'), usersController.uploadPhoto);
router.delete('/me', usersController.deleteMe);
router.get('/me/learning-profile', usersController.getLearningProfile);
router.get('/me/sessions', usersController.getSessions);
router.get('/me/progress', usersController.getProgress);
router.get('/me/devices', usersController.getDevices);
router.delete('/me/devices/:deviceId', usersController.logoutDevice);
router.get('/me/feature-access', usersController.getFeatureAccess);
router.get('/me/uploads', usersController.getUploads);

export default router;
