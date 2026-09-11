import type { Prisma } from '#server/types/prisma'

/**
 * Le classement de la liste des candidatures de bénévoles.
 *
 * La règle vit ici parce qu'elle était écrite deux fois — une fois pour la colonne principale, une
 * fois pour les colonnes suivantes — et que les deux copies avaient divergé. Le tri secondaire sur
 * les allergies visait `EditionVolunteerApplication.allergies`, qui n'existe pas : le champ est sur
 * le profil. Prisma refusait la requête et la liste entière partait en erreur, alors que le tri
 * principal sur la même colonne, dix-sept lignes plus haut, était juste.
 *
 * Une seule table de correspondance, donc, consultée par les deux. Une colonne ajoutée demain ne
 * peut plus être juste d'un côté et fausse de l'autre.
 *
 * ⚠️ Ce fichier ne doit rien importer d'autre qu'un type : il est chargé tel quel par les tests
 * unitaires, hors Nuxt.
 */

type OrderBy = Prisma.EditionVolunteerApplicationOrderByWithRelationInput

/** Le sens d'un tri. Tout ce qui n'est pas `asc` est traité comme `desc`, comme l'API le faisait. */
export type SensDeTri = 'asc' | 'desc'

/**
 * Les colonnes qu'on sait classer, et où chacune se lit.
 *
 * `profil` désigne celles qui vivent sur l'utilisateur et non sur la candidature. Le tri porte sur
 * le profil, comme l'affichage : classer sur la copie figée dans la candidature rangerait selon une
 * valeur que plus personne ne voit.
 */
const COLONNES = {
  pseudo: 'profil',
  prenom: 'profil',
  nom: 'profil',
  allergies: 'profil',
  status: 'candidature',
  createdAt: 'candidature',
  arrivalDateTime: 'candidature',
  departureDateTime: 'candidature',
} as const

/** Une colonne dont on sait faire un classement. */
export type ColonneDeTri = keyof typeof COLONNES

/** La colonne retenue quand rien d'exploitable n'est demandé : les candidatures les plus récentes. */
export const COLONNE_PAR_DEFAUT: ColonneDeTri = 'createdAt'

/** Dit si une saisie quelconque désigne une colonne que l'on sait classer. */
export function estColonneDeTri(champ: unknown): champ is ColonneDeTri {
  return typeof champ === 'string' && Object.hasOwn(COLONNES, champ)
}

/** `asc` demandé explicitement, `desc` dans tous les autres cas — y compris une saisie absurde. */
export function sensDeTri(sens: unknown): SensDeTri {
  return sens === 'asc' ? 'asc' : 'desc'
}

/**
 * Le fragment de classement d'une colonne, ou `null` si on ne sait pas la classer.
 *
 * Un champ inconnu rend `null` plutôt que de retomber sur une colonne par défaut : un tri
 * secondaire qu'on ne comprend pas doit être ignoré, pas remplacé par un autre — l'appelant n'a rien
 * demandé de tel, et le classement obtenu ne ressemblerait à rien de ce qu'il a cliqué.
 */
export function fragmentDeTri(champ: unknown, sens: unknown): OrderBy | null {
  if (!estColonneDeTri(champ)) return null
  const direction = sensDeTri(sens)
  return COLONNES[champ] === 'profil' ? { user: { [champ]: direction } } : { [champ]: direction }
}

/**
 * Le classement complet : la colonne principale, puis les colonnes de départage.
 *
 * Les deux n'ont pas la même tolérance, et c'est voulu. La principale retombe sur la date de
 * candidature quand elle est inconnue — il faut bien classer selon quelque chose. Les secondaires
 * sont écartées une à une : elles ne servent qu'à départager, et l'absence de départage est un
 * résultat acceptable.
 *
 * @param triSecondaire — une liste `champ:sens`, séparée par des virgules, telle que l'écran
 *   l'envoie pour les colonnes triées au-delà de la première.
 */
export function classementDesCandidatures(
  champPrincipal: unknown,
  sensPrincipal: unknown,
  triSecondaire?: string | null
): OrderBy[] {
  const principal =
    fragmentDeTri(champPrincipal, sensPrincipal) ??
    fragmentDeTri(COLONNE_PAR_DEFAUT, sensPrincipal)!

  const classement: OrderBy[] = [principal]

  for (const morceau of (triSecondaire ?? '').split(',')) {
    const [champ, sens] = morceau.trim().split(':')
    const fragment = fragmentDeTri(champ, sens)
    if (fragment) classement.push(fragment)
  }

  return classement
}
