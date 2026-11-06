import express from 'express';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import legalRoutes from '../src/modules/legal/legal.routes';
import { privacyPolicySourceHash } from '../src/modules/legal/privacy-policy.html';

describe('public privacy policy', () => {
  const app = express();
  app.use(legalRoutes);

  it('serves HTML without authentication or a database call', async () => {
    const response = await request(app).get('/privacy').expect(200);
    expect(response.headers['content-type']).toMatch(/text\/html/);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(response.text).toContain('<title>Privacy Policy | Akademi</title>');
    expect(response.text).toContain('name="viewport"');
    expect(response.text).toContain('href="mailto:support@akademi.app"');
    expect(response.text).toContain('does not automatically erase all account records');
    expect(response.text).toContain('OpenAI and Google Gemini');
    expect(response.text).toContain('ElevenLabs');
    expect(response.text).not.toMatch(/<script|<iframe|<img|privacy@akademi\.app/);
    expect(response.headers['content-security-policy']).toContain("default-src 'none'");
  });

  it('serves the policy at the exact path shown by Render', async () => {
    await request(app).get('/privacy/').expect(200);
    await request(app).head('/privacy').expect(200);
    await request(app).get('/not-a-legal-route').expect(404);
  });

  it('keeps the public document in sync with the policy shown inside the app', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../akademi-frontend/src/screens/main/PrivacyDataScreen.tsx'), 'utf8');
    const policy = source.slice(source.indexOf('const PrivacyPolicyContent:'), source.indexOf('const TermsOfServiceContent:'));
    const hash = crypto.createHash('sha256').update(policy.replace(/\r\n/g, '\n')).digest('hex');
    expect(hash).toBe(privacyPolicySourceHash);
  });
});
