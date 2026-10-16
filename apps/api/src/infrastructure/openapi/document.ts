import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

import { registerAuthOpenApi } from '../../modules/auth/auth.openapi.js';
import { registerFilesOpenApi } from '../../modules/files/files.openapi.js';
import { registerFinanceOpenApi } from '../../modules/finance/finance.openapi.js';
import { registerSystemOpenApi } from '../../modules/system/system.openapi.js';
import { registerUsersOpenApi } from '../../modules/users/users.openapi.js';

extendZodWithOpenApi(z);

export function generateOpenApiDocument() {
  const registry = new OpenAPIRegistry();
  registry.registerComponent('securitySchemes', 'sessionCookie', {
    type: 'apiKey',
    in: 'cookie',
    name: 'monthloom_session',
    description: 'HttpOnly session cookie set by login and registration.',
  });

  registerSystemOpenApi(registry);
  registerAuthOpenApi(registry);
  registerUsersOpenApi(registry);
  registerFilesOpenApi(registry);
  registerFinanceOpenApi(registry);

  return new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'Monthloom API',
      version: '0.1.0',
      description:
        'Human-readable contract for Monthloom clients. It is maintained for the web application and possible future native or standalone clients.',
    },
    servers: [{ url: '/' }],
    tags: [
      { name: 'Auth', description: 'Registration, sessions, and account recovery.' },
      { name: 'Users', description: 'Profile and credential management.' },
      { name: 'Files', description: 'Authenticated file storage.' },
      { name: 'Households', description: 'Households, sources, and transactions.' },
      { name: 'System', description: 'Operational health endpoints.' },
    ],
  });
}
