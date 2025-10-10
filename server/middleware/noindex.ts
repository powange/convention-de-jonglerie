export default defineEventHandler(async (event) => {
  // Vérifier si on est sur un environnement qui ne doit pas être indexé
  const shouldDisallowIndexing =
    process.env.NODE_ENV !== 'production' ||
    process.env.NUXT_ENV === 'staging' ||
    process.env.NUXT_ENV === 'release' ||
    !process.env.NUXT_APP_BASE_URL?.includes('juggling-convention.com')

  if (shouldDisallowIndexing) {
    // Ajouter les headers pour empêcher l'indexation
    setHeader(event, 'X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet, noimageindex')
  }
})
