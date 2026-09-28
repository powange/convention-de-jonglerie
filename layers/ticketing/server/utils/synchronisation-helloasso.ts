/**
 * Règles de prudence de la synchronisation HelloAsso.
 *
 * La synchronisation supprime les tarifs ET LES OPTIONS que HelloAsso ne renvoie plus. La
 * suppression est en cascade : disparaissent avec le tarif ses associations de quotas, ses articles
 * à remettre et ses liens vers les champs personnalisés — précisément le travail saisi dans
 * l'application, que HelloAsso ignore et ne pourra jamais restituer. Pour une option, la cascade va
 * plus loin encore : elle emporte le relevé de ce que chaque participant a acheté, si bien qu'on
 * saurait avoir encaissé sans plus savoir ce qui a été vendu.
 *
 * Or rien ne distingue « ce tarif a été supprimé chez HelloAsso » de « HelloAsso ne me l'a pas
 * renvoyé cette fois-ci » : panne partielle, changement d'API, jeton expiré côté formulaire.
 */

export interface DecisionSuppression<T> {
  aSupprimer: T[]
  /** Renseigné quand la suppression est refusée, pour être journalisé. */
  refus?: string
}

/** Ce qu'il faut savoir d'une espèce d'entité pour appliquer la règle. */
export interface EspeceSynchronisee<T> {
  /**
   * L'identifiant HelloAsso de l'entité, ou `null` si elle n'en a jamais eu.
   *
   * Les tarifs le portent en nombre (`helloAssoTierId`), les options en chaîne
   * (`helloAssoOptionId`) : d'où un accesseur plutôt qu'un nom de champ figé.
   */
  cle: (entite: T) => string | number | null
  /**
   * Ce que HelloAsso n'a pas renvoyé, article compris : « aucun tarif », « aucune option ».
   *
   * Porté par l'appelant, parce que le genre ne se devine pas depuis un nom : composer le message à
   * partir d'un simple « option » produisait « aucun option » dans le journal.
   */
  rienDeRecu: string
}

/**
 * Décide quelles entités supprimer après une réponse de HelloAsso.
 *
 * Une réponse vide alors que des entités existent est traitée comme suspecte : un formulaire de
 * billetterie sans aucun tarif est très improbable, et si le cas est réel, ne rien supprimer ne
 * coûte qu'un décalage — tandis qu'une suppression à tort est irréversible.
 *
 * Aucun seuil de proportion n'est appliqué au-delà : passer de dix tarifs à deux est un geste
 * d'organisateur parfaitement banal, et le refuser bloquerait un usage légitime.
 *
 * Générique depuis le 28/09/2026, et c'est le fond du correctif : la règle avait été écrite pour les
 * tarifs, et les OPTIONS, supprimées cent cinquante lignes plus bas dans le même fichier, n'en
 * avaient aucune. Leur cascade va pourtant plus loin — elle emporte le relevé de ce que chaque
 * participant a acheté. Une seconde copie de la règle aurait reproduit précisément ce que cette
 * fonction existe pour éviter : deux endroits à tenir d'accord.
 *
 * Les lignes reçues sont rendues telles quelles — pas une projection — pour que l'appelant garde
 * ses identifiants et ses libellés sans avoir à les rapprocher ensuite.
 */
export function decisionSuppression<T>(
  existants: readonly T[],
  idsRecus: ReadonlySet<string | number>,
  espece: EspeceSynchronisee<T>
): DecisionSuppression<T> {
  const synchronisees = existants.filter((entite) => espece.cle(entite) !== null)
  const candidats = synchronisees.filter((entite) => !idsRecus.has(espece.cle(entite)!))

  if (candidats.length === 0) return { aSupprimer: [] }

  if (idsRecus.size === 0 && synchronisees.length > 0) {
    return {
      aSupprimer: [],
      refus:
        // Tournure choisie pour éviter tout accord : « la base en compte N » vaut pour les deux genres.
        `HelloAsso n'a renvoyé ${espece.rienDeRecu}, alors que la base en compte ${synchronisees.length} : ` +
        'suppression écartée, la réponse est vraisemblablement incomplète.',
    }
  }

  return { aSupprimer: candidats }
}
