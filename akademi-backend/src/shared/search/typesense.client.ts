import { Client } from 'typesense';
import { config } from '../../config/env';

export const typesenseClient = new Client({
  nodes: [
    {
      host: config.typesenseHost,
      port: config.typesensePort,
      protocol: config.typesenseProtocol,
    },
  ],
  apiKey: config.typesenseApiKey,
  connectionTimeoutSeconds: 2,
});
