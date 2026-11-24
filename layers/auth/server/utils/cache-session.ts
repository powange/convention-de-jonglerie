/**
 * La génération de session d'un compte, mémorisée quelques secondes.
 *
 * ⚠️ CE QUE CE CACHE AMORTIT. `sessionRecevable` (middleware/auth.ts) interroge `User` à CHAQUE
 * requête munie d'une session, pour comparer la génération portée par le cookie à celle de la base.
 * Les écrans de gestion enchaînent cinq à quinze appels par page : chacun paie cette requête avant
 * même d'atteindre son handler, lequel recharge souvent l'utilisateur ensuite.
 *
 * ⚠️ CE QU'IL COÛTE, et c'est une décision assumée, pas un effet de bord découvert : une session
 * révoquée peut rester acceptée pendant la durée du cache. Le compromis est explicite — révocation
 * IMMÉDIATE sur l'instance qui l'a déclenchée, puisqu'elle oublie l'entrée, et au plus tard après
 * le TTL ailleurs. Avec une seule instance de l'application, « ailleurs » n'existe pas et la
 * révocation est toujours immédiate.
 *
 * ⚠️ D'OÙ L'IMPORTANCE D'OUBLIER PARTOUT. Six écritures rendent une entrée fausse, et il a fallu
 * les chercher — l'énoncé du lot n'en citait que deux catégories :
 *
 * 1. le changement de mot de passe (`profile/change-password`) ;
 * 2. la RÉINITIALISATION de mot de passe (`auth/reset-password`) — celle-ci manquait à l'énoncé, et
 *    c'est la plus sensible : on la demande justement quand on soupçonne que quelqu'un d'autre a
 *    son mot de passe. Un délai de grâce y serait le pire endroit possible ;
 * 3. et 4. la suppression de son propre compte et celle par un administrateur ;
 * 5. la fusion de comptes, qui supprime le compte source ;
 * 6. le remplacement du compte d'un artiste, qui supprime l'ancien s'il devient orphelin.
 *
 * Pour 3 à 6, une entrée périmée laisserait le middleware accepter la session d'un compte effacé —
 * et les handlers renverraient alors le « Utilisateur introuvable » déroutant que ce contrôle
 * existe précisément pour éviter.
 */

/** Trente secondes : assez pour couvrir une page d'écran de gestion, assez peu pour une révocation. */
const DUREE_DE_VIE_MS = 30_000

/**
 * Plafond d'entrées. Sans lui, le cache grandirait avec le nombre de comptes distincts vus depuis
 * le démarrage — une fuite lente, invisible, et d'autant plus grande que le serveur tourne longtemps.
 */
const MAX_ENTREES = 10_000

interface Entree {
  /** La génération lue en base, ou `null` quand le compte n'existe pas. */
  version: number | null
  expireA: number
}

const cache = new Map<number, Entree>()

/** Fait de la place : les entrées périmées d'abord, la plus ancienne ensuite. */
function faireDeLaPlace(maintenant: number): void {
  if (cache.size < MAX_ENTREES) return

  for (const [userId, entree] of cache) {
    if (entree.expireA <= maintenant) cache.delete(userId)
  }

  // Toujours plein : on évince les plus anciennes. Une `Map` conserve l'ordre d'insertion, donc
  // la première clé est la plus anciennement mémorisée.
  while (cache.size >= MAX_ENTREES) {
    const plusAncienne = cache.keys().next()
    if (plusAncienne.done) break
    cache.delete(plusAncienne.value)
  }
}

/**
 * La génération de session du compte, depuis le cache ou depuis la base.
 *
 * `null` signifie « ce compte n'existe pas », et cette réponse est mémorisée comme les autres :
 * sans cela, les requêtes d'une session orpheline interrogeraient la base à chaque appel — soit
 * exactement le cas que ce cache doit couvrir, une session dont le compte vient d'être supprimé.
 */
export async function versionDeSessionDuCompte(userId: number): Promise<number | null> {
  const maintenant = Date.now()
  const memorisee = cache.get(userId)

  if (memorisee && memorisee.expireA > maintenant) return memorisee.version

  const compte = await prisma.user.findUnique({
    where: { id: userId },
    select: { sessionVersion: true },
  })
  const version = compte?.sessionVersion ?? null

  faireDeLaPlace(maintenant)
  cache.set(userId, { version, expireA: maintenant + DUREE_DE_VIE_MS })
  return version
}

/**
 * Oublie ce compte : la prochaine requête relira la base.
 *
 * À appeler après TOUTE écriture qui change la génération de session ou supprime le compte. C'est
 * ce qui rend la révocation immédiate sur l'instance qui la déclenche.
 */
export function oublierSessionDuCompte(userId: number): void {
  cache.delete(userId)
}

/** Vide le cache — pour les tests, et pour un éventuel besoin d'exploitation. */
export function viderCacheDesSessions(): void {
  cache.clear()
}

/** Nombre d'entrées mémorisées, pour les tests et le diagnostic. */
export function tailleCacheDesSessions(): number {
  return cache.size
}
