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

/** Ce que la base sait déjà d'une ligne, pour décider des suites d'une annulation de la source. */
export interface LigneDejaSynchronisee {
  sourceCanceledAt: Date | null
  refunded: boolean
}

/**
 * Ce qu'une annulation annoncée par HelloAsso écrit sur la ligne.
 *
 * **Une annulation HelloAsso vaut remboursement.** La plateforme n'annule une ligne qu'en rendant
 * l'argent — c'est déjà l'hypothèse du rattrapage du 28/09, qui a marqué remboursées les douze
 * lignes annulées de la production. Sans cette règle, la ligne restait « réglée, annulée, non
 * remboursée » : le guichet réclamait au bénévole une somme que HelloAsso avait déjà rendue, et
 * l'alerte de double remboursement ne s'allumait qu'APRÈS qu'il l'eut rendue une seconde fois.
 *
 * Le remboursement est inscrit sans auteur : `refundedById` nul veut dire « par la plateforme »,
 * la convention du rattrapage. C'est ce qui garde l'alerte juste — elle exige `refundedById`, donc
 * une case cochée ICI avant que la source n'annonce l'annulation.
 *
 * Et sans date, comme au rattrapage : on sait QUE la plateforme a rendu l'argent, pas QUAND. La
 * date de la synchronisation — des jours plus tard, parfois — se lirait comme celle du
 * remboursement ; le guichet affiche « Remboursement effectué » sans date, et c'est juste.
 *
 * Tout se décide au moment où la source annonce l'annulation pour la première fois, et seulement
 * là (`sourceCanceledAt` encore nul). Un remboursement défait ensuite au guichet — le geste
 * existe depuis #581 — n'est donc pas recoché à la synchronisation suivante.
 *
 * @param existant la ligne en base, ou `null` quand la synchronisation la crée
 * @param sourceAnnule la charge HelloAsso donne-t-elle la ligne pour annulée ?
 */
export function suitesDeLAnnulationSource(
  existant: LigneDejaSynchronisee | null,
  sourceAnnule: boolean,
  maintenant: Date
): {
  sourceCanceledAt?: Date
  refunded?: true
  refundedAt?: null
  refundedById?: null
} {
  if (!sourceAnnule) return {}
  // Déjà notée : la décision a été prise au premier passage, on n'y revient pas.
  if (existant && existant.sourceCanceledAt !== null) return {}

  return {
    sourceCanceledAt: maintenant,
    // Remboursée ici avant que la source ne l'annonce : on garde l'auteur, et l'alerte de double
    // remboursement s'allume — c'est exactement le cas qu'elle existe pour signaler.
    ...(existant?.refunded ? {} : { refunded: true, refundedAt: null, refundedById: null }),
  }
}

/**
 * Le statut d'une commande HelloAsso, déduit de ses lignes telles que la SOURCE les décrit.
 *
 * Il était forcé à `Processed` : une commande entièrement remboursée sur la plateforme s'affichait
 * « Payée », billets annulés dessous, là où une commande annulée ici s'affiche « Annulée ».
 *
 * Seule la source compte. Des billets annulés un à un ICI ne font pas une commande annulée
 * HelloAsso — la plateforme l'encaisse toujours ; la commande le devient quand HelloAsso annule
 * toutes ses lignes. Le moyen de paiement, lui, reste renseigné : c'est ce qui dit à la règle du
 * montant dû que la commande avait été réglée.
 */
export function statutDeCommandeHelloAsso(lignesAnnuleesALaSource: readonly boolean[]) {
  return lignesAnnuleesALaSource.length > 0 && lignesAnnuleesALaSource.every(Boolean)
    ? ('Refunded' as const)
    : ('Processed' as const)
}
