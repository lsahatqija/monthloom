import { randomUUID } from 'node:crypto';

import { authResponseSchema } from '@template/contracts';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { buildAppDependencies } from '../src/composition.js';

export const app = createApp(buildAppDependencies());
export const api = '/api/v1';
export const password = 'Test-password-123!';

export async function register() {
  const agent = request.agent(app);
  const email = `${randomUUID()}@example.com`;
  const response = await agent
    .post(`${api}/auth/register`)
    .send({
      email,
      password,
      displayName: 'Test Person',
      profileImage: 'diamond-kilim',
      desiredColor: 'indigo',
    })
    .expect(201);
  const { user } = authResponseSchema.parse(response.body);
  return { agent, user, email, response };
}

export async function household(agent: ReturnType<typeof request.agent>) {
  const response = await agent
    .post(`${api}/households`)
    .send({ name: 'Test Home', icon: 'small-house', color: '#123456' })
    .expect(201);
  return response.body.household.id as string;
}
