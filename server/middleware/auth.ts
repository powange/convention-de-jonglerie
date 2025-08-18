// Note: on charge getUserSession dynamiquement pour faciliter le mocking dans les tests


export default defineEventHandler(async (event) => {
  const { getUserSession } = await import('#imports')
  const fullPath = event.path;
  const path = fullPath.split('?')[0]; // Extraire seulement la partie avant les paramètres de requête
  const requestMethod = event.node.req.method;

  // --- Public API Routes --- //
  // NuxtUI icon module routes should always be public
  if (path.startsWith('/api/_nuxt_icon/')) {
    return;
  }

  // Auth API routes (register, login, verify-email, resend-verification, password reset) are public for POST requests
  if (['/api/auth/register', '/api/auth/login', '/api/auth/verify-email', '/api/auth/resend-verification', '/api/auth/request-password-reset', '/api/auth/reset-password'].includes(path) && requestMethod === 'POST') {
    return;
  }

  // Auth API routes for GET requests (verify reset token)
  if (['/api/auth/verify-reset-token'].includes(path) && requestMethod === 'GET') {
    return;
  }

  // Feedback API route - public for POST (allows both authenticated and anonymous users)
  if (path === '/api/feedback' && requestMethod === 'POST') {
    // Autoriser anonymes; si session existante, lier user au contexte
  const session = await getUserSession(event)
    event.context.user = session?.user || null
    return;
  }
  
  // Note: GET /api/feedback et autres routes admin feedback restent protégées
  // Elles nécessitent une authentification (gérées plus bas dans le middleware)

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
    // Hydrater depuis la session uniquement
  const session = await getUserSession(event)
    if (session?.user) {
      event.context.user = session.user
      return
    }
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  // --- Page Routes (not API routes) --- //
  // Page routes are handled by client-side middleware (auth.client.ts) for redirection.
  // This server middleware does not protect page routes.
});
