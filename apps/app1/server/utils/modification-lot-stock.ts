/**
 * Ce qu'une modification par lot écrit, et ce qu'elle laisse tel quel.
 *
 * Sorti du gestionnaire pour la même raison que `emprunt-stock` : la règle vaut d'être éprouvée
 * seule, et l'écran qui la déclenche demande une session d'organisateur qu'un test ne peut pas
 * obtenir. C'est aussi la règle la plus facile à casser sans s'en rendre compte — une nuance entre
 * « ne pas y toucher » et « vider », sur une sélection qu'on ne relit pas ensuite objet par objet.
 */

/** Les champs qui n'ont de sens que sur un matériel emprunté à l'extérieur. */
export const CHAMPS_EMPRUNT = [
  'ownerContact',
  'returnDueAt',
  'pickupLocation',
  'pickupResponsibleId',
  'pickupContact',
  'returnLocation',
  'returnResponsibleId',
  'returnContact',
  // Les deux jalons. Ils suivent la même règle que le reste : absents, ils ne sont pas touchés ;
  // `null` annule le jalon. Leur cohérence mutuelle — on ne rend pas ce qu'on n'a pas récupéré —
  // se vérifie ailleurs, objet par objet, parce qu'elle dépend de l'état de chacun.
  'pickedUpAt',
  'returnedAt',
] as const

export type ChampEmprunt = (typeof CHAMPS_EMPRUNT)[number]

/** La demande, telle que le schéma la valide : chaque champ facultatif, `null` valant « vider ». */
export interface DemandeModificationLot {
  stockGroupId?: number
  location?: string | null
  zoneId?: number | null
  markerId?: number | null
  ownerContact?: string | null
  returnDueAt?: string | null
  pickupLocation?: string | null
  pickupResponsibleId?: number | null
  pickupContact?: string | null
  returnLocation?: string | null
  returnResponsibleId?: number | null
  returnContact?: string | null
  pickedUpAt?: string | null
  returnedAt?: string | null
}

/** Les deux jeux de champs à écrire : ceux de tout le matériel, et ceux du seul matériel emprunté. */
export interface ChangementsEnLot {
  communs: Record<string, unknown>
  emprunt: Record<string, unknown>
}

/**
 * Traduit la demande en champs à écrire.
 *
 * Un champ absent n'apparaît nulle part : il ne sera pas touché. C'est ce qui distingue « laisser
 * tel quel » de « vider », que l'écran exprime par une case à cocher devant chaque champ — sans
 * quoi ne changer que le groupe effacerait l'emplacement de toute la sélection.
 *
 * Poser une zone efface le marqueur, et l'inverse : les deux désignent le même emplacement sur la
 * carte et la fiche n'en affiche qu'un. Un objet qui portait un marqueur et reçoit une zone
 * garderait sinon les deux, sans que rien n'indique lequel fait foi.
 *
 * Les champs d'emprunt sont mis à part parce qu'ils ne s'appliqueront qu'au matériel effectivement
 * prêté : ailleurs, ils créeraient des données que la fiche n'affiche pas.
 */
export function changementsEnLot(demande: DemandeModificationLot): ChangementsEnLot {
  const communs: Record<string, unknown> = {}

  if (demande.stockGroupId !== undefined) communs.stockGroupId = demande.stockGroupId
  if (demande.location !== undefined) communs.location = demande.location || null
  if (demande.zoneId !== undefined || demande.markerId !== undefined) {
    communs.zoneId = demande.zoneId ?? null
    communs.markerId = demande.markerId ?? null
  }

  const emprunt: Record<string, unknown> = {}
  for (const champ of CHAMPS_EMPRUNT) {
    const valeur = demande[champ]
    if (valeur === undefined) continue
    // Les dates arrivent en texte ISO et repartent en `Date` ; le reste vaut sa valeur, ou `null`
    // s'il est vide — une chaîne vide n'est pas un contact, c'est l'absence de contact.
    const estUneDate = champ === 'returnDueAt' || champ === 'pickedUpAt' || champ === 'returnedAt'
    emprunt[champ] = estUneDate && valeur ? new Date(valeur as string) : valeur || null
  }

  return { communs, emprunt }
}
