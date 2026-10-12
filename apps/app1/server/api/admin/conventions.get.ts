import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { validatePagination } from '#server/utils/validation-helpers'
import { valeurDEnumeration } from '~~/shared/utils/filtres-enum'

/** Les trois états que l'écran propose. Une valeur inconnue est ignorée, comme ailleurs. */
const FILTRES = ['all', 'active', 'archived', 'unclaimed'] as const

/** Les huit tris de l'écran, et leur traduction en `orderBy` Prisma. */
const TRIS: Record<string, object> = {
  'name-asc': { name: 'asc' },
  'name-desc': { name: 'desc' },
  'date-desc': { createdAt: 'desc' },
  'date-asc': { createdAt: 'asc' },
  'updated-desc': { updatedAt: 'desc' },
  'updated-asc': { updatedAt: 'asc' },
  'editions-desc': { editions: { _count: 'desc' } },
  'editions-asc': { editions: { _count: 'asc' } },
}

export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et les droits admin (mutualisé)
    await requireGlobalAdminWithDbCheck(event)

    /*
     * ⚠️ FILTRE, TRI ET PAGINATION SONT PASSÉS AU SERVEUR — constat O3.
     *
     * Ce point d'API faisait UN `findMany` sans `take` ni `skip`, avec pour chaque convention
     * l'auteur, tous les organisateurs (profil compris), toutes les éditions (créateur, trois
     * `_count`, et le compte de candidatures via `Event`). La page, elle, ne faisait que filtrer
     * et trier ce tableau complet côté client. C'était le SEUL écran d'administration à liste
     * longue sans pagination — utilisateurs, retours, journal d'erreurs et notifications en ont
     * une.
     *
     * 📊 Mesuré : 71 conventions, 70 éditions, 95 organisateurs. Le volume est modeste
     * aujourd'hui, et le coût croît avec chaque édition importée.
     *
     * 📍 ET LES ADRESSES DE COURRIEL NE PARTENT PLUS. L'écran n'en affiche aucune : elles ne
     * servaient qu'au filtre de recherche, exécuté côté client — donc tout le trousseau
     * d'adresses des auteurs et des créateurs voyageait pour cela. La recherche porte désormais
     * sur `author.email` dans le `where`, côté serveur : la fonctionnalité est gardée, et
     * l'adresse ne quitte plus la base.
     */
    const requete = getQuery(event)
    const { page, limit, skip } = validatePagination(event)
    const recherche = (requete.search as string | undefined)?.trim() || ''
    const filtre = valeurDEnumeration(FILTRES, requete.archived) ?? 'all'
    const tri = TRIS[(requete.sort as string) || 'name-asc'] ?? TRIS['name-asc']!

    const where: Record<string, unknown> = {}
    if (filtre === 'active') where.isArchived = false
    else if (filtre === 'archived') where.isArchived = true
    // « Non revendiquée » : aucune ligne d'organisateur. `none` plutôt qu'un compte à zéro, que
    // Prisma ne sait pas filtrer.
    else if (filtre === 'unclaimed') where.organizers = { none: {} }

    if (recherche) {
      where.OR = [
        { name: { contains: recherche } },
        { description: { contains: recherche } },
        { author: { pseudo: { contains: recherche } } },
        // Cherchée ici et nulle part ailleurs : c'est ce qui permet de ne plus l'envoyer.
        { author: { email: { contains: recherche } } },
        { editions: { some: { name: { contains: recherche } } } },
        { editions: { some: { city: { contains: recherche } } } },
        { editions: { some: { country: { contains: recherche } } } },
      ]
    }

    /*
     * ⚠️ TROIS COMPTEURS GLOBAUX, ET C'EST LA PAGINATION QUI LES REND NÉCESSAIRES.
     *
     * L'en-tête de l'écran affiche « conventions », « éditions » et « actives ». Ils étaient
     * calculés côté client SUR LA LISTE COMPLÈTE (`conventions.length`, la somme des éditions,
     * le compte des non archivées). Paginer sans les déplacer les aurait rendus faux EN SILENCE :
     * l'en-tête aurait annoncé « 20 conventions » sur chaque page.
     *
     * Ils sont donc comptés en base, et **hors filtre** — comme aujourd'hui : ce sont des totaux
     * de l'instance, pas de la recherche en cours. `total`, lui, suit le `where`, puisque c'est
     * lui qui donne le nombre de pages.
     */
    const [total, totalGlobal, totalEditions, conventionsActives] = await Promise.all([
      prisma.convention.count({ where }),
      prisma.convention.count(),
      prisma.edition.count(),
      prisma.convention.count({ where: { isArchived: false } }),
    ])

    // Récupérer la page demandée, avec ses éditions et organisateurs
    const conventions = await prisma.convention.findMany({
      where,
      skip,
      take: limit,
      include: {
        author: {
          select: {
            id: true,
            pseudo: true,
            // Pas d'`email` : l'écran n'en affiche aucune, et la recherche par adresse se fait
            // maintenant dans le `where` ci-dessus — constat O3.
            nom: true,
            prenom: true,
          },
        },
        organizers: {
          select: {
            id: true,
            title: true,
            canAddEdition: true,
            canDeleteAllEditions: true,
            canDeleteConvention: true,
            canEditAllEditions: true,
            canEditConvention: true,
            canManageOrganizers: true,
            canManageVolunteers: true,
            user: {
              select: {
                id: true,
                pseudo: true,
                emailHash: true,
                nom: true,
                prenom: true,
                profilePicture: true,
              },
            },
          },
        },
        editions: {
          include: {
            creator: {
              select: {
                id: true,
                pseudo: true,
                // Pas d'`email` non plus : même raison que pour l'auteur.
                nom: true,
                prenom: true,
              },
            },
            _count: {
              select: {
                carpoolOffers: true,
                carpoolRequests: true,
                lostFoundItems: true,
              },
            },
            // Candidatures bénévoles : relation portée par Event (étape 0)
            event: {
              select: {
                _count: {
                  select: { volunteerApplications: true },
                },
              },
            },
          },
          orderBy: {
            startDate: 'desc',
          },
        },
        _count: {
          select: {
            editions: true,
            organizers: true,
          },
        },
      },
      orderBy: tri,
    })

    // Ré-aplatir le compte des candidatures (relation déplacée sur Event)
    const conventionsOut = conventions.map((c) => ({
      ...c,
      editions: c.editions.map(({ event, ...ed }) => ({
        ...ed,
        _count: { ...ed._count, volunteerApplications: event?._count?.volunteerApplications ?? 0 },
      })),
    }))

    /*
     * ⚠️ `total` ÉTAIT `conventions.length` — c'est-à-dire le nombre de lignes RENDUES. Sans
     * pagination la valeur était juste par accident ; avec, elle aurait annoncé « 20 conventions »
     * sur chaque page. Le compte vient donc du `count` sur le même `where`.
     *
     * 📍 LA FORME RESTE CELLE QU'ATTEND L'ÉCRAN (`conventions` + `total`), augmentée d'un bloc
     * `pagination`. Et elle n'est délibérément PAS mise sous enveloppe `{ success, data }` :
     * ce handler est l'un des 124 qui répondent hors enveloppe (constat A8 du socle serveur), et
     * cette migration se fait module par module AVEC son client — la faire ici, en passant,
     * casserait l'écran sans que ce lot ait rien à voir avec le sujet.
     */
    return {
      conventions: conventionsOut,
      total,
      // Les trois totaux de l'en-tête, indépendants de la page et du filtre.
      totaux: { conventions: totalGlobal, editions: totalEditions, actives: conventionsActives },
      pagination: {
        page,
        limit,
        totalCount: total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    }
  },
  { operationName: 'GetAdminConventions' }
)
