/**
 * Combien de temps une session reste valide, et quand elle doit être prolongée.
 *
 * « Se souvenir de moi » ne tenait pas sa promesse, et pour deux raisons qui se cumulaient :
 *
 * 1. La durée de 90 jours n'était passée qu'à l'ÉCRITURE de la session. Toutes les lectures
 *    appelaient `getUserSession` sans configuration, donc avec les 30 jours du `nuxt.config`,
 *    et h3 rejetait la session au-delà — en silence, puis en réécrivant le cookie.
 * 2. Le compte à rebours partait de la PREMIÈRE VISITE, même anonyme, et non de la connexion :
 *    une requête anonyme suffisait à poser un cookie et à démarrer l'horloge.
 *
 * La réponse retenue ne consiste pas à réconcilier les deux durées de h3, mais à ne plus lui
 * confier l'échéance du tout : la session porte la sienne, et chaque visite la repousse. C'est
 * ce qu'on attend d'un « se souvenir de moi » — rester connecté tant qu'on revient — et cela
 * rend le problème indépendant du `createdAt` que h3 ne rajeunit jamais.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** Les deux durées offertes, en secondes. */
export const DUREES_DE_SESSION = {
  /** Sans « se souvenir de moi » : de quoi traverser un week-end de convention. */
  ordinaire: 60 * 60 * 24 * 30,
  /** Avec « se souvenir de moi ». */
  prolongee: 60 * 60 * 24 * 90,
} as const

/**
 * En deçà de quelle part de vie restante on repousse l'échéance.
 *
 * Une session glissante suppose de réécrire le cookie, et le faire à chaque requête coûterait un
 * `Set-Cookie` sur la moindre image. On ne prolonge donc que lorsqu'il s'est écoulé assez de
 * temps pour que ce soit utile : tant qu'il reste plus de la moitié de la durée, la session est
 * déjà confortablement valide et la repousser n'apporte rien.
 *
 * Conséquence à connaître : quelqu'un qui revient tous les jours voit son cookie réécrit au plus
 * une fois par moitié de durée, soit deux fois par trimestre pour une session prolongée.
 */
export const SEUIL_DE_PROLONGATION = 0.5

/**
 * La durée de vie maximale d'une session, quoi qu'il arrive.
 *
 * Une fenêtre glissante seule a un défaut qu'elle ne peut pas corriger : elle ne distingue pas
 * le propriétaire du voleur. Qui détient le cookie peut le maintenir en vie indéfiniment en
 * passant de temps en temps — alors qu'avant cette correction, il mourait au plus tard au bout
 * de trente jours.
 *
 * Le plafond rétablit cette borne. C'est le motif recommandé partout : une fenêtre d'inactivité
 * ET une durée de vie absolue, la seconde bornant ce que la première peut prolonger.
 */
export const PLAFOND_ABSOLU = 60 * 60 * 24 * 365

/** Ce qu'une session transporte à propos de sa propre durée de vie. */
export interface EcheanceDeSession {
  /** L'instant où elle cesse d'être valide, en millisecondes depuis l'époque. */
  expireAt?: number | null
  /** La durée choisie à la connexion, en secondes — celle qu'on repousse à chaque visite. */
  dureeSecondes?: number | null
  /**
   * L'instant de la connexion.
   *
   * Distinct de `expireAt`, qu'on repousse : celui-ci ne bouge jamais, et c'est ce qui permet au
   * plafond absolu d'exister. Sans lui, une session glissante n'a aucune mémoire de son âge.
   */
  ouvertureAt?: number | null
  /**
   * Le cookie doit-il survivre à la fermeture du navigateur ?
   *
   * Faux quand « se souvenir de moi » n'a pas été coché : le cookie est alors un cookie de
   * session, que le navigateur efface en se fermant — ce que la case promet littéralement.
   */
  persistant?: boolean | null
}

/**
 * L'échéance portée par une session, ou `null` quand elle n'en porte pas.
 *
 * ⚠️ `Number(null)` vaut **zéro**, pas `NaN` : un simple `Number.isFinite` prendrait une échéance
 * absente pour une échéance à l'époque zéro, donc pour une session expirée depuis 1970. C'est
 * exactement la confusion « absence contre valeur » qui coûte cher ailleurs dans ce dépôt.
 */
function nombreLisible(brut: unknown): number | null {
  if (brut === null || brut === undefined) return null
  const valeur = Number(brut)
  return Number.isFinite(valeur) ? valeur : null
}

function echeanceLisible(echeance: EcheanceDeSession | null | undefined): number | null {
  return nombreLisible(echeance?.expireAt)
}

/** L'instant de connexion, ou `null` pour une session qui n'en porte pas. */
export function ouvertureDeLaSession(
  echeance: EcheanceDeSession | null | undefined
): number | null {
  return nombreLisible(echeance?.ouvertureAt)
}

/**
 * La session a-t-elle dépassé sa durée de vie absolue ?
 *
 * Une session sans instant d'ouverture — celles posées avant cette correction — n'est pas
 * réputée trop vieille : on ne sait pas son âge, et la rejeter déconnecterait tout le monde au
 * déploiement. Elle reçoit un instant d'ouverture à sa première lecture.
 */
export function tropVieille(
  echeance: EcheanceDeSession | null | undefined,
  maintenant: number
): boolean {
  const ouverture = ouvertureDeLaSession(echeance)
  if (ouverture === null) return false
  return maintenant - ouverture >= PLAFOND_ABSOLU * 1000
}

/** La durée à retenir pour une session, selon que la case a été cochée. */
export function dureeChoisie(seSouvenirDeMoi: boolean): number {
  return seSouvenirDeMoi ? DUREES_DE_SESSION.prolongee : DUREES_DE_SESSION.ordinaire
}

/**
 * Une durée lisible, ou celle par défaut.
 *
 * Les sessions posées AVANT cette correction ne portent pas de durée. Les traiter comme
 * ordinaires est le choix prudent : on ne prolonge pas de trois mois une session dont on ignore
 * si la case avait été cochée.
 */
export function dureeDeLaSession(echeance: EcheanceDeSession | null | undefined): number {
  const brut = echeance?.dureeSecondes
  const duree = brut === null || brut === undefined ? Number.NaN : Number(brut)
  if (!Number.isFinite(duree) || duree <= 0) return DUREES_DE_SESSION.ordinaire
  // Bornée par le haut : une durée venue d'une session ancienne ou malformée ne doit pas pouvoir
  // fabriquer une session éternelle.
  return Math.min(duree, DUREES_DE_SESSION.prolongee)
}

/** L'échéance à poser pour une durée donnée, à partir d'un instant. */
export function echeanceDepuis(maintenant: number, dureeSecondes: number): number {
  return maintenant + dureeSecondes * 1000
}

/**
 * Cette session est-elle encore valide ?
 *
 * Une session SANS échéance est acceptée, et c'est délibéré : ce sont celles posées avant cette
 * correction. Les invalider d'un coup déconnecterait tout le monde au déploiement — pour corriger
 * un défaut dont le symptôme est précisément d'être déconnecté sans prévenir. Elles reçoivent
 * une échéance à leur première lecture, et rejoignent le régime commun.
 */
export function sessionValide(
  echeance: EcheanceDeSession | null | undefined,
  maintenant: number
): boolean {
  if (tropVieille(echeance, maintenant)) return false
  const expire = echeanceLisible(echeance)
  if (expire === null) return true
  return maintenant < expire
}

/** Ce qu'il faut faire d'une session à sa lecture. */
export interface DecisionDeLecture {
  /** La session est-elle encore utilisable ? */
  valide: boolean
  /** Faut-il réécrire le cookie pour repousser l'échéance ? */
  prolonger: boolean
  /** La nouvelle échéance à écrire, quand il y a lieu de prolonger. */
  nouvelleEcheance?: number
}

/**
 * Ce qu'on fait d'une session qu'on vient de lire.
 *
 * Trois cas, et le troisième est celui qui fait toute la différence avec le comportement
 * précédent : une session valide dont il reste peu de temps est **prolongée**, au lieu de courir
 * vers une expiration que rien ne repousse.
 */
export function decisionDeLecture(
  echeance: EcheanceDeSession | null | undefined,
  maintenant: number
): DecisionDeLecture {
  if (!sessionValide(echeance, maintenant)) return { valide: false, prolonger: false }

  const duree = dureeDeLaSession(echeance)
  const expire = echeanceLisible(echeance)

  // Sans échéance — une session d'avant la correction : on lui en pose une sans attendre.
  if (expire === null) {
    return {
      valide: true,
      prolonger: true,
      nouvelleEcheance: bornerAuPlafond(echeanceDepuis(maintenant, duree), echeance),
    }
  }

  const restant = expire - maintenant
  if (restant > duree * 1000 * SEUIL_DE_PROLONGATION) return { valide: true, prolonger: false }

  const souhaitee = echeanceDepuis(maintenant, duree)
  const bornee = bornerAuPlafond(souhaitee, echeance)
  // Prolonger jusqu'à une date que le plafond rejettera de toute façon donnerait un cookie qui
  // annonce une validité qu'il n'a pas. Mieux vaut que l'échéance dise la vérité.
  if (bornee <= maintenant) return { valide: true, prolonger: false }

  return { valide: true, prolonger: true, nouvelleEcheance: bornee }
}

/** Une échéance ne dépasse jamais l'instant d'ouverture augmenté du plafond. */
function bornerAuPlafond(
  souhaitee: number,
  echeance: EcheanceDeSession | null | undefined
): number {
  const ouverture = ouvertureDeLaSession(echeance)
  if (ouverture === null) return souhaitee
  return Math.min(souhaitee, ouverture + PLAFOND_ABSOLU * 1000)
}
