import { wrapApiHandler, createPaginatedResponse } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'
import { validatePagination, validateEditionId } from '#server/utils/validation-helpers'
import {
  articleRetenu,
  articlesRetenus,
  filtresDArticlesActifs,
} from '~~/shared/utils/articles-de-commande-retenus'

interface CustomFieldAnswer {
  name: string
  answer: string
}

interface CustomFieldFilter {
  name: string
  value: string
}

// Fonction helper pour vérifier si une commande correspond aux filtres customFields
function orderMatchesCustomFieldFilters(
  order: { items: { customFields: unknown }[] },
  filters: CustomFieldFilter[],
  mode: 'and' | 'or' = 'and'
): boolean {
  const matchesFilter = (filter: CustomFieldFilter) =>
    order.items.some((item) => {
      if (!item.customFields || !Array.isArray(item.customFields)) return false
      return (item.customFields as CustomFieldAnswer[]).some(
        (field) => field.name === filter.name && String(field.answer) === filter.value
      )
    })

  // Mode ET : tous les filtres doivent être satisfaits
  // Mode OU : au moins un filtre doit être satisfait
  return mode === 'and' ? filters.every(matchesFilter) : filters.some(matchesFilter)
}

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à ces données',
      })

    // Paramètres de pagination et filtres
    const query = getQuery(event)
    const { page, limit, skip, take } = validatePagination(event)
    const search = (query.search as string) || ''
    const tierIdsParam = (query.tierIds as string) || ''
    const tierIds = tierIdsParam ? tierIdsParam.split(',').map((id) => parseInt(id)) : []
    const optionIdsParam = (query.optionIds as string) || ''
    const optionIds = optionIdsParam ? optionIdsParam.split(',').map((id) => parseInt(id)) : []
    const entryStatus = (query.entryStatus as string) || 'all'
    const paymentMethodsParam = (query.paymentMethods as string) || ''
    const paymentMethods = paymentMethodsParam
      ? paymentMethodsParam
          .split(',')
          .filter((m) => ['cash', 'card', 'check', 'unknown'].includes(m))
      : []

    // Filtre par statut de commande. La liste blanche est la même que `StatutCommande` côté
    // écran ; une valeur inconnue est ignorée plutôt que transmise, sans quoi un paramètre
    // fabriqué à la main rendrait une liste vide sans rien expliquer.
    //
    // `Refunded` signifie « annulée », pas « remboursée » — cf. `commande-annulee.ts`.
    const statusesParam = (query.statuses as string) || ''
    const statuses = statusesParam
      ? statusesParam
          .split(',')
          .filter((s) => ['Pending', 'Onsite', 'Processed', 'Refunded'].includes(s))
      : []

    // Parse le filtre par type d'item (Registration, Donation, Membership, Payment)
    const itemTypesParam = (query.itemTypes as string) || ''
    const itemTypes = itemTypesParam
      ? itemTypesParam
          .split(',')
          .filter((t) => ['Registration', 'Donation', 'Membership', 'Payment'].includes(t))
      : []

    // Parse les filtres de champs personnalisés (format JSON array)
    const customFieldFiltersParam = (query.customFieldFilters as string) || ''
    let customFieldFilters: CustomFieldFilter[] = []
    if (customFieldFiltersParam) {
      try {
        const parsed = JSON.parse(customFieldFiltersParam)
        if (Array.isArray(parsed)) {
          customFieldFilters = parsed.filter(
            (f): f is CustomFieldFilter =>
              typeof f === 'object' && typeof f.name === 'string' && typeof f.value === 'string'
          )
        }
      } catch {
        // Ignorer les erreurs de parsing JSON
      }
    }

    // Mode de filtrage des champs personnalisés (ET ou OU)
    const customFieldFilterMode =
      (query.customFieldFilterMode as string) === 'or' ? 'or' : ('and' as const)

    try {
      // Vérifier si la recherche est un ID numérique
      const searchAsNumber = parseInt(search)
      const isNumericSearch = search && !isNaN(searchAsNumber) && searchAsNumber > 0

      // Construire la condition de recherche
      const searchCondition = search
        ? {
            OR: [
              // Recherche par ID de commande (si numérique)
              ...(isNumericSearch ? [{ id: searchAsNumber }] : []),
              { payerFirstName: { contains: search } },
              { payerLastName: { contains: search } },
              { payerEmail: { contains: search } },
              { checkNumber: { contains: search } },
              {
                items: {
                  some: {
                    OR: [
                      // Recherche par ID de billet (si numérique)
                      ...(isNumericSearch ? [{ id: searchAsNumber }] : []),
                      { name: { contains: search } },
                      { firstName: { contains: search } },
                      { lastName: { contains: search } },
                      { email: { contains: search } },
                    ],
                  },
                },
              },
            ],
          }
        : {}

      // Construire la condition de filtre par méthode de paiement
      const paymentMethodCondition =
        paymentMethods.length > 0
          ? {
              OR: paymentMethods.map((method) => {
                // `unknown` reste ici : c'est une commande payée dont le moyen n'a pas été
                // renseigné, donc bien une réponse à « comment a-t-elle été réglée ».
                if (method === 'unknown') {
                  return {
                    AND: [
                      { OR: [{ status: 'Processed' }, { status: 'Onsite' }] },
                      { paymentMethod: null },
                    ],
                  }
                } else {
                  return { paymentMethod: method as 'cash' | 'card' | 'check' }
                }
              }),
            }
          : {}

      // Construire la condition de filtre par statut de commande
      const statusCondition = statuses.length > 0 ? { status: { in: statuses } } : {}

      // Construire la condition de filtre combinée pour les items
      const itemsConditions: any[] = []

      // Ajouter le filtre par tarifs si nécessaire
      if (tierIds.length > 0) {
        itemsConditions.push({
          tierId: {
            in: tierIds,
          },
        })
      }

      // Ajouter le filtre par statut d'entrée si nécessaire
      if (entryStatus === 'validated') {
        itemsConditions.push({
          entryValidated: true,
        })
      } else if (entryStatus === 'not_validated') {
        itemsConditions.push({
          entryValidated: {
            not: true,
          },
        })
      }

      // Ajouter le filtre par options (mode OU - au moins une des options sélectionnées)
      if (optionIds.length > 0) {
        itemsConditions.push({
          selectedOptions: {
            some: {
              optionId: { in: optionIds },
            },
          },
        })
      }

      // Ajouter le filtre par type d'item (Participant, Donation, Membership, Payment)
      if (itemTypes.length > 0) {
        itemsConditions.push({
          type: { in: itemTypes },
        })
      }

      // Construire la condition finale pour les items
      const itemsCondition =
        itemsConditions.length > 0
          ? {
              items: {
                some:
                  itemsConditions.length === 1
                    ? itemsConditions[0]
                    : {
                        AND: itemsConditions,
                      },
              },
            }
          : {}

      /**
       * Les critères de filtrage, composés UNE seule fois et combinés par ET.
       *
       * Deux raisons à cette forme.
       *
       * La première : ils étaient recopiés à quatre endroits — la liste, son décompte, la variante
       * qui filtre les champs personnalisés en mémoire, et les statistiques. Ajouter un critère
       * demandait de penser aux quatre, et en oublier un ne casse rien de visible : la liste et son
       * total se mettent simplement à décrire deux ensembles différents.
       *
       * La seconde est un défaut que cette réécriture corrige. La recherche et le filtre par moyen
       * de paiement produisent TOUS DEUX une clé `OR`. Étalés dans un même objet littéral, le
       * second écrasait le premier : chercher un nom en filtrant sur « Liquide » rendait TOUTES les
       * commandes en liquide, la recherche passée à la trappe — sans message, sans indice à
       * l'écran, et avec un total cohérent avec la mauvaise réponse. Chaque critère occupe
       * désormais sa propre entrée du `AND`, où deux `OR` ne peuvent plus se recouvrir.
       */
      const criteres = [statusCondition, paymentMethodCondition, itemsCondition].filter(
        (condition) => Object.keys(condition).length > 0
      )

      /**
       * Les mêmes critères, mais applicables à UN article.
       *
       * `items: { some: … }` ci-dessus choisit les COMMANDES : celles qui portent au moins un
       * article correspondant. Elles arrivent ensuite avec la totalité de leurs articles, y
       * compris ceux d'un tarif qu'on n'a pas demandé — le bandeau annonçait donc « 1 commande,
       * 2 billets » là où un seul billet portait le tarif choisi.
       *
       * La règle vit dans `articles-de-commande-retenus`, avec ses tests, et le client s'en sert
       * pour griser les mêmes articles. Elle doit rendre exactement le verdict des conditions
       * ci-dessus : c'est le seul point qui compte, et c'est ce que ses tests vérifient.
       */
      const filtresDArticles = { tierIds, entryStatus, optionIds, itemTypes }
      const triDesArticlesActif = filtresDArticlesActifs(filtresDArticles)

      // `AND` n'apparaît que s'il porte quelque chose : sans filtre, la requête reste le simple
      // `{ editionId }` qu'elle a toujours été, et qui se lit d'un coup d'œil dans un journal.
      const avecCriteres = (conditions: any[]) =>
        conditions.length > 0 ? { editionId, AND: conditions } : { editionId }

      /** Les statistiques ne sont calculées qu'en l'absence de recherche : elles n'en ont pas. */
      const filtresSansRecherche = avecCriteres(criteres)
      const filtreDesCommandes = avecCriteres(search ? [...criteres, searchCondition] : criteres)

      // Vérifier si on doit filtrer par customFields (nécessite filtrage JS)
      const hasCustomFieldFilter = customFieldFilters.length > 0

      // Include commun pour les items
      const itemsInclude = {
        include: {
          tier: {
            include: {
              handoutItems: {
                include: {
                  handoutItem: true,
                },
              },
            },
          },
          selectedOptions: {
            include: {
              option: true,
            },
            orderBy: { id: 'asc' as const },
          },
        },
        orderBy: { id: 'asc' as const },
      }

      let orders: any[]
      let total: number

      if (hasCustomFieldFilter) {
        // Récupérer TOUTES les commandes sans pagination pour filtrer par customFields
        const allOrders = await prisma.ticketingOrder.findMany({
          where: filtreDesCommandes,
          include: {
            externalTicketing: {
              select: {
                provider: true,
              },
            },
            items: itemsInclude,
          },
          orderBy: { orderDate: 'desc' },
        })

        // Filtrer par customFields en JavaScript
        const filteredOrders = allOrders.filter((order) =>
          orderMatchesCustomFieldFilters(order, customFieldFilters, customFieldFilterMode)
        )

        // Calculer le total après filtrage
        total = filteredOrders.length

        // Appliquer la pagination manuellement
        orders = filteredOrders.slice(skip, skip + take)
      } else {
        // Compter le nombre total de commandes
        total = await prisma.ticketingOrder.count({
          where: filtreDesCommandes,
        })

        // Récupérer les commandes paginées
        orders = await prisma.ticketingOrder.findMany({
          where: filtreDesCommandes,
          include: {
            externalTicketing: {
              select: {
                provider: true,
              },
            },
            items: itemsInclude,
          },
          orderBy: { orderDate: 'desc' },
          skip,
          take,
        })
      }

      // Calculer les stats globales en tenant compte des filtres
      let stats = null
      if (!search) {
        const allOrders = await prisma.ticketingOrder.findMany({
          where: filtresSansRecherche,
          select: {
            amount: true,
            status: true,
            paymentMethod: true,
            externalTicketingId: true,
            items: {
              // De quoi rejouer les filtres article par article : sans `tierId`, sans
              // `entryValidated` et sans les options, on ne peut que tout compter.
              select: {
                type: true,
                amount: true,
                tierId: true,
                entryValidated: true,
                selectedOptions: { select: { optionId: true } },
              },
            },
          },
        })

        /** Les articles de cette commande que les filtres retiennent réellement. */
        const retenusDe = (order: (typeof allOrders)[number]) =>
          articlesRetenus(order.items, filtresDArticles)

        /**
         * Ce que cette commande apporte au montant affiché.
         *
         * Sans tri d'article, c'est le montant de la COMMANDE, et rien ne change : sur 565
         * commandes de cette base, 18 ont un montant supérieur à la somme de leurs articles —
         * des frais de billetterie externe, qui ne sont portés par aucun article. Reconstituer
         * systématiquement le montant en sommant les articles ferait donc baisser un chiffre
         * qu'on rapproche d'un relevé bancaire.
         *
         * Dès qu'un tri est actif, en revanche, le montant suit les articles retenus : c'est ce
         * que le filtre promet, et laisser le total de la commande entière contredirait le
         * compte de billets affiché juste à côté.
         */
        const montantDe = (
          order: (typeof allOrders)[number],
          retenus: ReturnType<typeof retenusDe>
        ) =>
          triDesArticlesActif ? retenus.reduce((sum, item) => sum + item.amount, 0) : order.amount

        const parCommande = allOrders.map((order) => {
          const retenus = retenusDe(order)
          return { order, retenus, montant: montantDe(order, retenus) }
        })

        const totalItems = parCommande.reduce(
          (sum, { retenus }) => sum + retenus.filter((item) => item.type !== 'Donation').length,
          0
        )

        const totalAmount = parCommande.reduce((sum, { montant }) => sum + montant, 0)

        const totalDonations = parCommande.reduce(
          (sum, { retenus }) => sum + retenus.filter((item) => item.type === 'Donation').length,
          0
        )

        const totalDonationsAmount = parCommande.reduce(
          (sum, { retenus }) =>
            sum +
            retenus
              .filter((item) => item.type === 'Donation')
              .reduce((itemSum, item) => itemSum + item.amount, 0),
          0
        )

        // Calculer les montants par méthode de paiement
        const amountsByPaymentMethod = parCommande.reduce(
          (acc, { order, montant }) => {
            // La même contribution que celle du total : sinon le détail par moyen de paiement
            // cesserait d'additionner jusqu'au montant affiché juste au-dessus.
            const amount = montant

            if (order.status === 'Pending') {
              acc.pending += amount
            } else if (order.status === 'Refunded') {
              acc.refunded += amount
            } else if (order.paymentMethod === 'card') {
              // Distinguer carte HelloAsso et carte sur place
              if (order.externalTicketingId) {
                acc.cardHelloAsso += amount
              } else {
                acc.cardOnsite += amount
              }
            } else if (order.paymentMethod === 'cash') {
              acc.cash += amount
            } else if (order.paymentMethod === 'check') {
              acc.check += amount
            } else if (order.status === 'Processed' || order.status === 'Onsite') {
              // Anciennes commandes payées sans méthode spécifique
              acc.online += amount
            }

            return acc
          },
          {
            cardHelloAsso: 0,
            cardOnsite: 0,
            cash: 0,
            check: 0,
            online: 0,
            pending: 0,
            refunded: 0,
          }
        )

        stats = {
          totalOrders: total,
          totalItems,
          totalAmount,
          totalDonations,
          totalDonationsAmount,
          amountsByPaymentMethod,
        }
      }

      /**
       * Chaque article dit s'il répond aux filtres, ou s'il n'est là que parce que sa commande y
       * répond.
       *
       * La liste montre la commande ENTIÈRE — la masquer amputerait ce qu'on a vendu à cette
       * personne, et l'écran ne s'appelle pas « billets » mais « commandes ». Le client grise
       * donc ce que le filtre écarte, plutôt que de le cacher ou de laisser croire que tout y
       * répond.
       */
      const commandesMarquees = orders.map((order) => ({
        ...order,
        items: (order.items ?? []).map((item: any) => ({
          ...item,
          retenuParLesFiltres: !triDesArticlesActif || articleRetenu(item, filtresDArticles),
        })),
      }))

      return {
        ...createPaginatedResponse(commandesMarquees, total, page, limit),
        stats,
      }
    } catch (error: unknown) {
      console.error('Failed to fetch orders from DB:', error)
      throw createError({
        status: 500,
        message: 'Erreur lors de la récupération des commandes',
      })
    }
  },
  { operationName: 'GET ticketing orders' }
)
