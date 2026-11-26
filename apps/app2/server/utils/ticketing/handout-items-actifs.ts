/**
 * Articles à remettre (billetterie) — contrat d'hôte du layer artistes. Flowvent n'a pas encore la
 * billetterie (lot 6 de docs/flowvent-modules.md) : aucun article à remettre, et les points qui en
 * gèrent répondent 403 plutôt que d'écrire dans des tables sans usage.
 */
export async function articlesARemettreActifs(_editionId: number): Promise<boolean> {
  return false
}

export async function exigerArticlesARemettreActifs(_editionId: number): Promise<void> {
  throw createError({
    status: 403,
    message: 'Les articles à remettre ne sont pas encore disponibles dans Flowvent',
  })
}
