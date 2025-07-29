import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';


export default defineEventHandler(async (event) => {
  const fullPath = event.path;
  const path = fullPath.split('?')[0]; // Extraire seulement la partie avant les paramètres de requête
  const requestMethod = event.node.req.method;

  // --- Public API Routes --- //
  // NuxtUI icon module routes should always be public
  if (path.startsWith('/api/_nuxt_icon/')) {
    return;
  }

  // Auth API routes (register, login, verify-email, resend-verification) are public for POST requests
  if (['/api/auth/register', '/api/auth/login', '/api/auth/verify-email', '/api/auth/resend-verification'].includes(path) && requestMethod === 'POST') {
    return;
  }

  // Public GET routes pour conventions et éditions
  const publicGetRoutes = [
    '/api/conventions',  // Liste des conventions
    '/api/editions',     // Liste des éditions
  ];
  
  // Routes publiques pour récupérer des détails spécifiques (avec pattern [id])
  const isPublicEditionDetail = path.match(/^\/api\/editions\/\d+$/) && requestMethod === 'GET';
  const isPublicConventionDetail = path.match(/^\/api\/conventions\/\d+$/) && requestMethod === 'GET';
  
  if (publicGetRoutes.includes(path) && requestMethod === 'GET') {
    return;
  }
  
  if (isPublicEditionDetail || isPublicConventionDetail) {
    return;
  }

  // Public GET /api/countries (listing available countries)
  if (path === '/api/countries' && requestMethod === 'GET') {
    return;
  }

  // Public GET /api/uploads/* (static file serving)
  if (path.startsWith('/api/uploads/') && requestMethod === 'GET') {
    return;
  }

  // Public GET routes pour covoiturage (consultation des offres et demandes)
  const isPublicCarpoolOffers = path.match(/^\/api\/editions\/\d+\/carpool-offers$/) && requestMethod === 'GET';
  const isPublicCarpoolRequests = path.match(/^\/api\/editions\/\d+\/carpool-requests$/) && requestMethod === 'GET';
  
  // Public GET routes pour les commentaires de covoiturage
  const isPublicCarpoolOfferComments = path.match(/^\/api\/carpool-offers\/\d+\/comments$/) && requestMethod === 'GET';
  const isPublicCarpoolRequestComments = path.match(/^\/api\/carpool-requests\/\d+\/comments$/) && requestMethod === 'GET';
  
  // Public GET routes pour les posts et commentaires d'édition
  const isPublicEditionPosts = path.match(/^\/api\/editions\/\d+\/posts$/) && requestMethod === 'GET';
  
  if (isPublicCarpoolOffers || isPublicCarpoolRequests || isPublicCarpoolOfferComments || isPublicCarpoolRequestComments || isPublicEditionPosts) {
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
