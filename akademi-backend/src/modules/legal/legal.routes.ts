import { Router } from 'express';
import { privacyPolicyHtml } from './privacy-policy.html';

const router = Router();

// Public, database-independent HTML for the Play Console privacy policy URL.
router.get('/privacy', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
  res.status(200).type('html').send(privacyPolicyHtml);
});

export default router;
