import { handleRequest } from './core';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  return handleRequest(req);
}
