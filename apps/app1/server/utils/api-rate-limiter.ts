import { adresseDuClient, createRateLimiter } from './rate-limiter'

/**
 * Combien de fichiers un compte peut déposer en une heure.
 *
 * ## ⚠️ POURQUOI SOIXANTE, ET NON DIX
 *
 * Le chiffre d'origine était **dix**, et ce limiteur n'était branché nulle part — donc jamais
 * éprouvé contre un usage réel. Dix est trop peu : un organisateur qui monte la galerie d'une
 * édition, les justificatifs d'une note de frais ou les photos d'objets trouvés en dépose
 * facilement plus en une session, et se retrouverait bloqué une heure au milieu de son travail.
 *
 * Soixante tient les deux bouts : c'est au-delà de ce qu'une personne dépose à la main dans
 * l'heure, et cela borne ce qu'un compte peut écrire sur le volume de production à **600 Mo** par
 * heure (la taille maximale d'un fichier est de 10 Mo). Avant, c'était illimité.
 *
 * ## ⚠️ ET POURQUOI IL EST RELEVÉ EN DÉVELOPPEMENT ET EN E2E
 *
 * Même raison que `authRateLimiter` et `registerRateLimiter` : une suite de bout en bout dépose
 * plusieurs fichiers d'affilée sous un même compte, et se heurterait à un 429 qui n'a rien à voir
 * avec ce qu'elle teste. Un test rouge pour cette raison-là se diagnostique très mal.
 */
export const MAX_ENVOIS_PAR_HEURE = import.meta.dev || process.env.E2E_TEST === 'true' ? 1000 : 60

/**
 * Rate limiter pour les uploads d'images
 *
 * ⚠️ LA CLÉ EST L'UTILISATEUR, donc ce limiteur doit être appelé APRÈS `requireAuth` : avant, tous
 * les envois tomberaient dans le même seau `upload:anonymous` et le premier abus bloquerait tout le
 * monde. Les huit points d'envoi exigeant une session, la clé est toujours un compte réel.
 */
export const uploadRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: MAX_ENVOIS_PAR_HEURE,
  message: "Trop d'uploads, veuillez réessayer plus tard",
  keyGenerator: (event) => {
    const user = event.context.user
    return user ? `upload:${user.id}` : 'upload:anonymous'
  },
})

/*
 * ⚠️ TROIS LIMITEURS ONT ÉTÉ RETIRÉS D'ICI : `contentCreationRateLimiter`,
 * `commentRateLimiter` et `searchRateLimiter`.
 *
 * Aucun n'avait d'appelant — mesuré un par un, zéro usage hors de ce fichier. Un limiteur qu'on
 * n'appelle pas n'est pas une protection, c'est un commentaire : il donne l'impression que la
 * surface est gardée, et c'est précisément ce qui a laissé les envois de fichiers sans borne
 * pendant si longtemps.
 *
 * Les brancher là où leur nom l'indique demanderait, pour chacun, un seuil justifié et ses propres
 * cas de test — trois chantiers, pas un. Ils sont donc supprimés plutôt que gardés en vitrine ;
 * l'historique les rend en une commande le jour où on en voudra un.
 */

/**
 * Rate limiter pour le checkout Stripe (donations)
 * 10 tentatives par heure par IP
 */
export const checkoutRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 10,
  message: 'Trop de tentatives de paiement, veuillez réessayer plus tard',
  keyGenerator: (event) => `checkout:${adresseDuClient(event)}`,
})

/**
 * Rate limiter pour les recherches de personnes
 * 60 requêtes par minute par utilisateur
 *
 * Ces points d'API rendent des gens : on les protège d'un balayage méthodique — « aa », « ab »,
 * « ac »… — qui reconstituerait un annuaire à petites doses.
 *
 * La clé est l'utilisateur et non l'IP : ces recherches exigent une session, la menace est donc un
 * compte, pas une adresse. Compter par IP punirait au passage les organisateurs qui partagent le
 * wifi d'un même lieu. (Ce paragraphe citait `searchRateLimiter`, retiré depuis faute d'appelant.)
 *
 * Soixante par minute, calé sur deux repères : c'est le débit que le projet a déjà retenu pour la
 * recherche, et c'est six à dix fois ce qu'une frappe humaine produit — le champ n'émet qu'après
 * 300 ms de pause, et chercher une personne coûte trois à cinq requêtes.
 */
export const personSearchRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: 'Trop de recherches, veuillez réessayer dans une minute',
  keyGenerator: (event) => {
    const user = event.context.user
    return user ? `person-search:${user.id}` : 'person-search:anonymous'
  },
})
