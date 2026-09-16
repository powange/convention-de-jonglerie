/**
 * L'interrupteur « articles à remettre » d'une édition, et ce qu'il coupe vraiment.
 *
 * Il ne rangeait que l'entrée de menu et la carte du tableau de bord. La page de configuration
 * restait accessible par son adresse, les points d'API acceptaient toujours les écritures, et le
 * guichet continuait de réclamer des articles. Un interrupteur qui ne coupe rien invite à croire
 * que la fonctionnalité est éteinte alors qu'elle tourne.
 *
 * ⚠️ C'est un **écart assumé** avec le reste du projet : aucun autre module — repas, artistes,
 * bénévoles — ne refuse ses pages ni ses points d'API quand son drapeau est éteint. Le choix a
 * été fait explicitement pour celui-ci, parce qu'un article non remis se constate au comptoir,
 * trop tard. L'écran de configuration demande confirmation avant d'éteindre quand des articles
 * existent déjà, faute de quoi la remise s'arrêterait sans prévenir.
 */

/** Le drapeau de l'édition, ou `true` pour une édition introuvable — le défaut du schéma. */
export async function articlesARemettreActifs(editionId: number): Promise<boolean> {
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    select: { ticketingHandoutItemsEnabled: true },
  })

  // Une édition absente n'est pas notre affaire ici : les points d'API la refusent déjà par
  // leurs contrôles de droits, et rendre `false` transformerait un 404 en un 403 trompeur.
  return edition?.ticketingHandoutItemsEnabled ?? true
}

/**
 * Refuse l'écriture quand la fonctionnalité est éteinte.
 *
 * À appeler **après** le contrôle des droits : qui n'a pas le droit d'être là ne doit pas
 * apprendre au passage si l'édition a activé la fonctionnalité.
 */
export async function exigerArticlesARemettreActifs(editionId: number): Promise<void> {
  if (await articlesARemettreActifs(editionId)) return

  throw createError({
    status: 403,
    message: 'Les articles à remettre sont désactivés sur cette édition',
  })
}
