/**
 * Règles de prudence de la synchronisation HelloAsso.
 *
 * La synchronisation supprime les tarifs que HelloAsso ne renvoie plus. La suppression est en
 * cascade : disparaissent avec le tarif ses associations de quotas, ses articles à remettre et
 * ses liens vers les champs personnalisés — précisément le travail saisi dans l'application, que
 * HelloAsso ignore et ne pourra jamais restituer.
 *
 * Or rien ne distingue « ce tarif a été supprimé chez HelloAsso » de « HelloAsso ne me l'a pas
 * renvoyé cette fois-ci » : panne partielle, changement d'API, jeton expiré côté formulaire.
 */

export interface TarifExistant {
  id: number
  name: string | null
  helloAssoTierId: number | null
}

export interface DecisionSuppression {
  aSupprimer: TarifExistant[]
  /** Renseigné quand la suppression est refusée, pour être journalisé. */
  refus?: string
}

/**
 * Décide quels tarifs supprimer après une réponse de HelloAsso.
 *
 * Une réponse vide alors que des tarifs existent est traitée comme suspecte : un formulaire de
 * billetterie sans aucun tarif est très improbable, et si le cas est réel, ne rien supprimer ne
 * coûte qu'un décalage — tandis qu'une suppression à tort est irréversible.
 *
 * Aucun seuil de proportion n'est appliqué au-delà : passer de dix tarifs à deux est un geste
 * d'organisateur parfaitement banal, et le refuser bloquerait un usage légitime.
 */
export function decisionSuppression(
  existants: readonly TarifExistant[],
  idsRecus: ReadonlySet<number>
): DecisionSuppression {
  const candidats = existants.filter(
    (t) => t.helloAssoTierId !== null && !idsRecus.has(t.helloAssoTierId)
  )

  if (candidats.length === 0) return { aSupprimer: [] }

  const rattachesAHelloAsso = existants.filter((t) => t.helloAssoTierId !== null)
  if (idsRecus.size === 0 && rattachesAHelloAsso.length > 0) {
    return {
      aSupprimer: [],
      refus:
        `HelloAsso n'a renvoyé aucun tarif alors que ${rattachesAHelloAsso.length} sont enregistrés : ` +
        'suppression écartée, la réponse est vraisemblablement incomplète.',
    }
  }

  return { aSupprimer: candidats }
}
