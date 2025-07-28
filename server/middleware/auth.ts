import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  const path = event.path;
  const requestMethod = event.node.req.method;

  // --- Public API Routes --- //
  // NuxtUI icon module routes should always be public
  if (path.startsWith('/api/_nuxt_icon/')) {
    return;
  }

  // Auth API routes (register, login) are public for POST requests
  if (['/api/auth/register', '/api/auth/login'].includes(path) && requestMethod === 'POST') {
    return;
  }

  // Public GET /api/conventions (listing all conventions)
  if (path.startsWith('/api/conventions') && requestMethod === 'GET') {
    return;
  }

  // Public GET /api/editions (listing all editions)
  if (path.startsWith('/api/editions') && requestMethod === 'GET') {
    return;
  }

  // Public GET /api/countries (listing available countries)
  if (path === '/api/countries' && requestMethod === 'GET') {
    return;
  }

  // --- Protect all other API routes --- //
  // Only apply token check if the path starts with /api/
  if (path.startsWith('/api/')) {
    const token = event.node.req.headers.authorization?.split(' ')[1];

    if (!token) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: No token provided',
      });
    }

    try {
      const config = useRuntimeConfig();
      const decoded = jwt.verify(token, config.jwtSecret) as { userId: number };
      
      event.context.user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, pseudo: true, nom: true, prenom: true },
      });

      if (!event.context.user) {
        throw createError({
          statusCode: 401,
          statusMessage: 'Unauthorized: User not found',
        });
      }
    } catch {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: Invalid token',
      });
    }
  }

  // --- Page Routes (not API routes) --- //
  // Page routes are handled by client-side middleware (auth.client.ts) for redirection.
  // This server middleware does not protect page routes.
});
