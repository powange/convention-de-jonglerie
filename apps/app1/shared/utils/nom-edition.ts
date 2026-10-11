/**
 * Le nom sous lequel une édition se présente — constat B5 de l'administration.
 *
 * ## Pourquoi cette règle est partagée
 *
 * Elle existait en TROIS versions, et la troisième était fausse. Le rappel manuel d'édition
 * composait `` `${edition.convention.name} - ${edition.title}` `` — or `Edition` **n'a pas** de
 * champ `title` : la notification reçue s'intitulait « Convention X - **undefined** ». La tâche
 * des échéances de tâches, elle, portait déjà la bonne règle, en ligne ; et le client en avait sa
 * propre copie.
 *
 * ## 📊 POURQUOI UN SEUL NOM, ET NON UNE COMPOSITION — mesuré, pas supposé
 *
 * La fiche proposait de garder la composition et d'ajouter un repli. Relevé sur les **70 éditions**
 * de la base de développement :
 *
 * | | éditions |
 * | --- | --- |
 * | sans nom du tout | **32** (46 %) |
 * | dont le nom COMMENCE par celui de la convention | **21** sur 38 |
 * | dont le nom est exactement celui de la convention | 2 |
 *
 * Composer donnerait donc « Jongle en Zik - Jongle en Zik 2025 » dans la majorité des cas nommés.
 * Et ce n'est pas un hasard : le commentaire du schéma dit que `Edition.name` EST le « nom
 * d'affichage de l'événement », déjà de la forme « Convention - Édition ». Le paramètre qui reçoit
 * cette chaîne s'appelle du reste `editionName`, au singulier.
 *
 * ## Le dernier repli
 *
 * `Edition.name` est nullable et `Convention.name` ne l'est pas — mais une édition peut être
 * ORPHELINE (importée, sans convention revendiquée), et la relation n'est alors pas chargée. D'où
 * le numéro en dernier recours : une notification qui dit « Édition #42 » reste exploitable, une
 * notification qui dit « undefined » ne l'est pas. C'est exactement ce que fait déjà la tâche des
 * échéances.
 */
export function nomAffichableDEdition(edition: {
  id?: number | null
  name?: string | null
  convention?: { name?: string | null } | null
}): string {
  return (
    edition.name || edition.convention?.name || (edition.id ? `Édition #${edition.id}` : 'Édition')
  )
}
