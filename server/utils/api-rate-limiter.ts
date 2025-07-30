import { createRateLimiter } from './rate-limiter';

/**
 * Rate limiter pour les uploads d'images
 * 10 uploads par heure par utilisateur
 */
export const uploadRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 10,
  message: 'Trop d\'uploads, veuillez réessayer plus tard',
  keyGenerator: (event) => {
    const user = event.context.user;
    return user ? `upload:${user.id}` : 'upload:anonymous';
  }
});

/**
 * Rate limiter pour la création de contenu (conventions, éditions, posts)
 * 20 créations par heure par utilisateur
 */
export const contentCreationRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 heure  
  max: 20,
  message: 'Trop de créations de contenu, veuillez réessayer plus tard',
  keyGenerator: (event) => {
    const user = event.context.user;
    return user ? `content:${user.id}` : 'content:anonymous';
  }
});

/**
 * Rate limiter pour les commentaires
 * 30 commentaires par heure par utilisateur
 */
export const commentRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 30,
  message: 'Trop de commentaires, veuillez ralentir',
  keyGenerator: (event) => {
    const user = event.context.user;
    return user ? `comment:${user.id}` : 'comment:anonymous';
  }
});

/**
 * Rate limiter pour les API de recherche
 * 60 requêtes par minute par IP
 */
export const searchRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: 'Trop de recherches, veuillez réessayer dans une minute',
  keyGenerator: (event) => {
    const ip = event.node.req.headers['x-forwarded-for'] || 
               event.node.req.socket.remoteAddress || 
               'unknown';
    return `search:${ip}`;
  }
});