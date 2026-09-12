/**
 * Ce qu'emporte la déconnexion d'une billetterie externe.
 *
 * La base est en cascade : effacer la configuration efface ses tarifs, ses options et ses
 * commandes — et chaque commande emporte ses billets. La confirmation n'annonçait rien de tout
 * cela. Elle demandait « êtes-vous sûr de vouloir déconnecter la billetterie ? », ce qui laisse
 * croire qu'on défait un branchement, alors qu'on détruit des enregistrements de vente.
 *
 * Ce qui survit, et c'est la nuance qui fait la valeur de ce décompte : les tarifs et les commandes
 * saisis à la main ne sont pas rattachés à la configuration externe, donc la cascade ne les touche
 * pas. Annoncer « toutes vos commandes » serait aussi faux qu'annoncer zéro.
 *
 * La règle vit ici parce qu'elle décide de ce qu'on annonce avant un geste irréversible, et qu'un
 * décompte faux vaudrait mieux ne pas exister : mieux vaut ne rien dire que rassurer à tort.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** La configuration externe, réduite à ce qui compte pour la confirmation. */
export interface ConfigurationSupprimable {
  /**
   * Le décompte des éléments rattachés, tel que l'API le rend.
   *
   * Tous sont comptés, y compris les commandes remboursées : la cascade ne fait pas le tri, et
   * annoncer moins que ce qui disparaît serait mentir par omission.
   */
  _count?: { tiers?: number; options?: number; orders?: number } | null
}

/** Ce que la confirmation doit annoncer. */
export interface ResumeDeconnexion {
  tarifs: number
  options: number
  commandes: number
  /** Y a-t-il quelque chose à annoncer&nbsp;? Faux quand rien n'a encore été importé. */
  quelqueChoseDisparait: boolean
}

/**
 * Le décompte de ce qui part.
 *
 * Un compte manquant est traité comme zéro plutôt que de faire échouer l'affichage : une API qui
 * cesserait de rendre ce champ rendrait sinon la confirmation impossible, et l'on retomberait sur
 * l'ancienne — celle qui n'annonçait rien.
 */
export function resumeDeconnexionBilletterie(
  configuration: ConfigurationSupprimable | null | undefined
): ResumeDeconnexion {
  const compte = configuration?._count
  const tarifs = compte?.tiers ?? 0
  const options = compte?.options ?? 0
  const commandes = compte?.orders ?? 0

  return {
    tarifs,
    options,
    commandes,
    quelqueChoseDisparait: tarifs + options + commandes > 0,
  }
}
