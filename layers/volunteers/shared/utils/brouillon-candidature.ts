/**
 * Brouillon d'une candidature de bénévole en cours de saisie.
 *
 * Le formulaire compte plus de vingt champs — motivation, disponibilités, régime, allergies,
 * contact d'urgence. Tout se perdait au moindre retour arrière, et il faut alors tout ressaisir :
 * beaucoup renoncent à ce moment-là.
 *
 * Le brouillon reste sur l'appareil et n'est jamais transmis. Il porte des données sensibles, d'où
 * une péremption : sur un ordinateur partagé, des allergies saisies puis abandonnées n'ont pas à
 * rester indéfiniment à la disposition du suivant.
 */

/** Au-delà, le brouillon est considéré comme abandonné et n'est plus restitué. */
export const PEREMPTION_BROUILLON_JOURS = 7

export interface BrouillonEnregistre {
  enregistreLe: string
  donnees: Record<string, unknown>
}

/**
 * La clé de rangement, propre à une édition ET à un utilisateur.
 *
 * Les deux comptent : sans l'édition, candidater à une seconde convention proposerait la saisie
 * faite pour la première ; sans l'utilisateur, un appareil familial rendrait à l'un ce que
 * l'autre avait commencé à écrire.
 */
export function cleBrouillon(editionId: number, userId: number | null | undefined): string {
  return `brouillon-candidature-${editionId}-${userId ?? 'anonyme'}`
}

/** Un brouillon est-il encore d'actualité ? */
export function brouillonValide(
  brouillon: unknown,
  maintenant: Date = new Date(),
  peremptionJours: number = PEREMPTION_BROUILLON_JOURS
): brouillon is BrouillonEnregistre {
  if (!brouillon || typeof brouillon !== 'object') return false

  const candidat = brouillon as Partial<BrouillonEnregistre>
  if (typeof candidat.enregistreLe !== 'string') return false
  if (!candidat.donnees || typeof candidat.donnees !== 'object') return false

  const enregistreLe = new Date(candidat.enregistreLe)
  if (Number.isNaN(enregistreLe.getTime())) return false

  // Une date future vient d'une horloge déréglée : on ne s'en sert pas pour décider d'une
  // péremption, mais on ne jette pas non plus la saisie de l'utilisateur.
  const ageJours = (maintenant.getTime() - enregistreLe.getTime()) / 86_400_000
  return ageJours <= peremptionJours
}

/**
 * Ne retient du brouillon que les champs que le formulaire connaît encore.
 *
 * Un formulaire évolue : un champ retiré, renommé, ou dont le type change réapparaîtrait sinon
 * dans un état que le reste du code ne sait plus traiter.
 */
export function champsRestituables<T extends Record<string, unknown>>(
  donnees: Record<string, unknown>,
  reference: T
): Partial<T> {
  const retenus: Record<string, unknown> = {}

  for (const [cle, valeur] of Object.entries(donnees)) {
    if (!(cle in reference)) continue

    const attendu = reference[cle]
    // `undefined` de référence ne dit rien du type attendu : on accepte alors la valeur telle
    // quelle, faute de pouvoir la comparer à quoi que ce soit.
    if (attendu === undefined || valeur === undefined || valeur === null) {
      retenus[cle] = valeur
      continue
    }

    const memeForme =
      Array.isArray(attendu) === Array.isArray(valeur) && typeof attendu === typeof valeur
    if (memeForme) retenus[cle] = valeur
  }

  return retenus as Partial<T>
}
