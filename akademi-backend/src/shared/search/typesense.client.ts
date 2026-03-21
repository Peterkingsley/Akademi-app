import { Client } from 'typesense';
import { config } from '../../config/env';

export const typesenseClient = new Client({
  nodes: [
    {
      host: config.typesenseHost,
      port: config.typesensePort,
      protocol: 'http', // Typesense usually runs on http unless configured otherwise
    },
  ],
  apiKey: config.typesenseApiKey,
  connectionTimeoutSeconds: 2,
});
