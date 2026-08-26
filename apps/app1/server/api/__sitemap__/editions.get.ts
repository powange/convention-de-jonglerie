import { wrapApiHandler } from '#server/utils/api-helpers'

/**
 * URLs des éditions pour le sitemap.
 *
 * Une page n'y figure que si un visiteur anonyme y verrait quelque chose. Les conditions
 * reprennent celles qu'appliquent les points d'API correspondants plutôt que de les
 * réinventer : le programme et la FAQ répondent 404 tant qu'ils ne sont pas publiés, et la
 * carte affiche « Édition introuvable » module éteint — les annoncer sans vérifier
 * reviendrait à déclarer des URLs mortes ou des pages d'erreur.
 *
 * Les pages sans contenu sont écartées de la même façon : une liste vide d'objets trouvés ou
 * une page de publications sans publication n'apporte rien à l'indexation.
 */
export default wrapApiHandler(
  async () => {
    // Récupérer toutes les éditions publiques (convention non archivée, statuts visibles publiquement)
    const editions = await prisma.edition.findMany({
      where: {
        convention: {
          isArchived: false,
        },
        status: { in: ['PUBLISHED', 'PLANNED', 'CANCELLED'] },
      },
      select: {
        id: true,
        updatedAt: true,
        startDate: true,
        endDate: true,
        // Chaque module porte son activation, et pour certains une publication distincte :
        // on compose un programme des semaines avant qu'il ne mérite d'être montré.
        programEnabled: true,
        programPagePublic: true,
        faqEnabled: true,
        faqPagePublic: true,
        siteMapEnabled: true,
        mapPublic: true,
        workshopsEnabled: true,
        // Ces deux pages répondent toujours 200 : c'est leur contenu qui décide.
        _count: {
          select: { lostFoundItems: true, editionPosts: true },
        },
      },
    })

    const urls: Array<{
      loc: string
      lastmod: string
      changefreq: 'weekly' | 'monthly'
      priority: number
    }> = []

    editions.forEach((edition) => {
      // Priorité plus élevée pour les éditions futures et récentes
      const now = new Date()
      const isUpcoming = new Date(edition.startDate) > now
      const isRecent =
        new Date(edition.endDate) > new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 jours

      let priority = 0.5
      if (isUpcoming) priority = 0.9
      else if (isRecent) priority = 0.7

      const changefreq = isUpcoming ? ('weekly' as const) : ('monthly' as const)
      const lastmod = edition.updatedAt.toISOString()

      const ajouter = (chemin: string, facteur: number) =>
        urls.push({
          loc: `/editions/${edition.id}${chemin}`,
          lastmod,
          changefreq,
          priority: priority * facteur,
        })

      // Page principale de l'édition : toujours accessible
      ajouter('', 1)

      // Programme : activé ET publié. Sans quoi l'API répond 404, sans distinguer les deux
      // cas pour ne rien révéler d'un programme en préparation.
      if (edition.programEnabled && edition.programPagePublic) {
        ajouter('/program', 0.8)
      }

      // FAQ : même couple de drapeaux, même 404 quand il manque l'un des deux.
      if (edition.faqEnabled && edition.faqPagePublic) {
        ajouter('/faq', 0.6)
      }

      // Carte du site : la page répond 200 même module éteint, mais affiche « Édition
      // introuvable » — une page d'erreur qu'un moteur indexerait comme du contenu.
      if (edition.siteMapEnabled && edition.mapPublic) {
        ajouter('/map', 0.6)
      }

      // Ateliers : la page existe toujours, mais reste vide sans le module.
      if (edition.workshopsEnabled) {
        ajouter('/workshops', 0.7)
      }

      // Publications : rien à indexer tant que personne n'a publié.
      if (edition._count.editionPosts > 0) {
        ajouter('/comments', 0.8)
      }

      // Covoiturage : ouvert en permanence, y compris avant l'édition — c'est là que les
      // trajets se cherchent.
      ajouter('/carpool', 0.7)

      // Objets trouvés : après le début de l'édition, et seulement s'il y en a. Avant, la
      // page annonce elle-même qu'elle se remplira une fois l'édition commencée.
      const hasStarted = new Date(edition.startDate) <= now
      if (hasStarted && edition._count.lostFoundItems > 0) {
        ajouter('/lost-found', 0.6)
      }
    })

    return urls
  },
  { operationName: 'GenerateEditionsSitemap' }
)
