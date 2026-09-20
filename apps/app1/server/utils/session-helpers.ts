import type { H3Event } from 'h3'

import {
  decisionDeLecture,
  dureeChoisie,
  echeanceDepuis,
  type EcheanceDeSession,
} from '~~/shared/utils/duree-de-session'

/**
 * Fines enveloppes autour des auto-imports nuxt-auth-utils (getUserSession / clearUserSession /
 * setUserSession).
 *
 * But : permettre au code serveur d'accéder à la session SANS faire `await import('#imports')`.
 * Cet import dynamique charge le module d'auto-imports *entier* — or, en dev, Nitro génère un
 * `#imports` incohérent (il ré-exporte toutes les fonctions h3 mais n'en importe qu'une partie),
 * ce qui lève `appendCorsHeaders is not defined` au chargement et renvoie 500 sur toutes les routes.
 *
 * Ici, getUserSession/clearUserSession/setUserSession sont utilisés comme auto-imports Nitro
 * (résolus et tree-shakés à la compilation, sans matérialiser l'objet ré-export cassé), et ce
 * module reste un vrai module relatif, donc mockable proprement dans les tests via `vi.mock`.
 */

/** Le nom du cookie, tel que nuxt-auth-utils le configure. */
const NOM_DU_COOKIE = 'nuxt-session'

/**
 * La requête porte-t-elle déjà une session ?
 *
 * Question indispensable avant d'interroger h3 : `getSession` ne se contente pas de lire, il
 * **crée** une session quand il n'en trouve pas, et pose le cookie dans la foulée. Un visiteur
 * anonyme qui allait recevoir un 401 repartait donc avec un cookie — et surtout avec un
 * `createdAt` qui démarrait l'horloge de sa future session, des semaines avant sa connexion.
 * Mesuré en production : `GET /api/session/me` sans session répondait 401 ET posait le cookie.
 *
 * L'en-tête est lu directement plutôt que par `getCookie` de h3 : ce dernier ne rend rien sous
 * l'environnement de test, et la question ne mérite pas qu'on en dépende — il s'agit de savoir
 * si un nom figure dans une liste.
 */
export function aUneSessionDansLaRequete(event: H3Event): boolean {
  const brut = (event as any)?.node?.req?.headers?.cookie
  if (typeof brut !== 'string' || brut.length === 0) return false
  return brut.split(';').some((morceau) => morceau.trim().startsWith(`${NOM_DU_COOKIE}=`))
}

/**
 * Les trois primitives de session, isolées derrière une couture.
 *
 * Les auto-imports Nitro ne sont pas résolus sous vitest — le `#imports` du serveur n'est pas
 * celui que `test/setup.ts` double, et c'est l'incohérence que l'en-tête de ce fichier décrit
 * déjà. Plutôt que de contourner l'environnement, on nomme la dépendance : la production garde
 * les auto-imports, les tests passent les leurs.
 *
 * Les valeurs par défaut sont enveloppées dans des fonctions, donc évaluées à l'APPEL : un
 * auto-import absent au chargement du module ne fait plus échouer son import.
 */
export interface PrimitivesDeSession {
  lire: (event: H3Event) => Promise<any>
  ecrire: (event: H3Event, data: any, config?: any) => Promise<any>
  effacer: (event: H3Event) => Promise<any>
}

const PRIMITIVES_PAR_DEFAUT: PrimitivesDeSession = {
  lire: (event) => getUserSession(event),
  ecrire: (event, data, config) => setUserSession(event, data, config),
  effacer: (event) => clearUserSession(event),
}

/**
 * La configuration de cookie pour une échéance donnée.
 *
 * h3 ne décide plus de rien — `session.maxAge` a été retiré du nuxt.config —, donc c'est ici que
 * l'échéance se pose, et nulle part ailleurs.
 *
 * Sans « se souvenir de moi », aucune date n'est écrite : le cookie devient un **cookie de
 * session**, que le navigateur efface en se fermant. C'est ce que la case promet littéralement,
 * et ce que fait la plupart des sites. L'échéance côté serveur subsiste comme filet — un cookie
 * capturé ne survit pas pour autant à sa durée.
 */
function cookiePourEcheance(echeance: number, persistant: boolean) {
  return { cookie: persistant ? { expires: new Date(echeance) } : {} }
}

/**
 * Lit la session, et la fait GLISSER.
 *
 * Préfixe « Auth » pour éviter la collision avec les auto-imports h3 (getSession/clearSession),
 * qui produisait des warnings « Duplicated imports » côté Nitro.
 *
 * Trois choses s'y jouent, et la troisième est nouvelle :
 *
 * 1. sans cookie entrant, on ne touche pas à h3 — aucune session n'est créée pour un anonyme ;
 * 2. une session dont l'échéance est passée est effacée, franchement, au lieu d'être remplacée
 *    en silence par une session vide comme le faisait h3 ;
 * 3. une session encore valide mais entamée voit son échéance **repoussée**. C'est ce qui fait
 *    d'elle une session glissante : on reste connecté tant qu'on revient.
 */
export async function getAuthSession(
  event: H3Event,
  primitives: PrimitivesDeSession = PRIMITIVES_PAR_DEFAUT
) {
  if (!aUneSessionDansLaRequete(event)) return null

  const session = await primitives.lire(event)

  // Un cookie présent mais illisible donne une session vide : h3 en fabrique une neuve sans
  // utilisateur. La prolonger reviendrait à poser un cookie daté à un visiteur anonyme — la
  // brèche qu'on vient de refermer, par une autre porte.
  if (!(session as { user?: unknown })?.user) return null

  const decision = decisionDeLecture(session as EcheanceDeSession, Date.now())

  if (!decision.valide) {
    await primitives.effacer(event)
    return null
  }

  if (decision.prolonger && decision.nouvelleEcheance !== undefined) {
    await primitives.ecrire(
      event,
      { expireAt: decision.nouvelleEcheance },
      // Une session non persistante le reste : prolonger ne doit pas transformer un cookie de
      // session en cookie daté, ce qui reviendrait à cocher la case à la place de la personne.
      cookiePourEcheance(
        decision.nouvelleEcheance,
        (session as EcheanceDeSession)?.persistant === true
      )
    )
  }

  return session
}

/**
 * Ouvre une session, avec sa durée de vie.
 *
 * Tout ce qui connecte quelqu'un passe par ici — le formulaire, les deux fournisseurs OAuth, la
 * vérification d'adresse, l'acceptation d'invitation, l'usurpation d'identité. Écrire la session
 * sans échéance laisserait un cookie que plus rien ne ferme, puisque h3 ne s'en occupe plus.
 */
export async function ouvrirSession(
  event: H3Event,
  data: Parameters<typeof setUserSession>[1],
  options: { seSouvenirDeMoi?: boolean; sessionVersion?: number } = {},
  primitives: PrimitivesDeSession = PRIMITIVES_PAR_DEFAUT
) {
  const persistant = options.seSouvenirDeMoi === true
  const duree = dureeChoisie(persistant)
  const maintenant = Date.now()
  const echeance = echeanceDepuis(maintenant, duree)

  return primitives.ecrire(
    event,
    {
      ...data,
      expireAt: echeance,
      dureeSecondes: duree,
      // Ne bouge jamais, contrairement à `expireAt` : c'est lui qui donne son sens au plafond
      // absolu, en gardant la mémoire de l'âge d'une session qui glisse.
      ouvertureAt: maintenant,
      persistant,
      // La génération trouvée à la création. Le middleware la compare à celle du compte :
      // l'incrémenter ferme toutes les sessions ouvertes d'un coup.
      sessionVersion: options.sessionVersion ?? 0,
    },
    cookiePourEcheance(echeance, persistant)
  )
}

export function clearAuthSession(event: H3Event) {
  return clearUserSession(event)
}
