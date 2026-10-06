import { wrapApiHandler, createPaginatedResponse } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'
import { alternativesMotCle, motsClesDeLaRequete } from '#server/utils/recherche-mots-cles'
import { ETATS_DE_BILLET_ANNULE } from '#server/utils/ticketing/billets-qui-comptent'
import { billetARembourser, montantARembourser } from '#server/utils/ticketing/remboursement-du'
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
    const refundStatus = (query.refundStatus as string) || 'all'
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
      /** L'identifiant visé par un mot, quand ce mot en est un. */
      const identifiantDuMot = (mot: string) => {
        const nombre = parseInt(mot)
        return !isNaN(nombre) && nombre > 0 ? [{ id: nombre }] : []
      }

      /**
       * La recherche, mot par mot.
       *
       * **Chaque mot** doit se retrouver quelque part — sur la commande ou sur l'un de ses billets.
       * Le terme entier était auparavant cherché dans chaque champ séparément : « Jean Dupont »
       * n'étant ni un prénom ni un nom, la liste ne rendait rien, alors que « Jean » seul trouvait
       * la commande.
       *
       * Les mots sont évalués indépendamment, y compris à travers `items.some` : sur une commande
       * de plusieurs billets, « Jean Dupont » la retient même si Jean et Dupont sont deux
       * personnes différentes. C'est voulu — la commande les contient bien toutes les deux, et
       * c'est elle que cet écran liste.
       */
      const clausesDeRecherche = motsClesDeLaRequete(search).map((mot) => ({
        OR: [
          ...identifiantDuMot(mot),
          // Les champs plats de la commande passent par l'util ; la traversée `items.some` ne
          // s'exprime pas en chemin pointé et reste donc écrite ici.
          ...alternativesMotCle(mot, [
            'payerFirstName',
            'payerLastName',
            'payerEmail',
            'checkNumber',
          ]),
          {
            items: {
              some: {
                OR: alternativesMotCle(mot, ['name', 'firstName', 'lastName', 'email']).concat(
                  identifiantDuMot(mot)
                ),
              },
            },
          },
        ],
      }))

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

      // « À rembourser » : billet annulé, réglé, et pas encore remboursé. La condition vient du
      // même fichier que la règle affichée au guichet — deux écritures de la même question
      // finissent toujours par ne plus dire la même chose.
      if (refundStatus === 'du') {
        itemsConditions.push(billetARembourser())
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
      // Les clauses de recherche rejoignent les autres critères plutôt que de s'imbriquer dans un
      // `AND` de plus : une recherche vide — ou réduite à des espaces — n'en produit aucune, et
      // la liste reste alors celle de tous les résultats, ce qui est le bon défaut ICI (l'écran
      // affiche les commandes par défaut, contrairement à la recherche du contrôle d'accès).
      const filtreDesCommandes = avecCriteres([...criteres, ...clausesDeRecherche])

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

      /**
       * Ce que rapporte un billet, et s'il rapporte encore — la règle de la trésorerie.
       *
       * ⚠️ On somme les BILLETS, jamais `order.amount`. Le montant de la commande est figé à sa
       * création : annuler un billet ne le baisse pas, si bien qu'il comptait comme vendus les
       * billets annulés un par un (édition 22 : 4 tee-shirts sur 14, 72 € en trop sous le seul
       * filtre de ce tarif). Il n'apportait rien d'autre : mesuré sur toute la base de
       * développement, il vaut TOUJOURS la somme des billets et de leurs options. Les 18
       * commandes où il dépassait la somme des billets s'expliquent entièrement par leurs
       * options — et non par des frais de billetterie externe, comme on l'a cru un temps.
       *
       * 📍 Les options comptent, filtre posé ou non. Sous un filtre d'article, le montant
       * reprenait le seul prix des billets et les perdait.
       *
       * Annulé = billet `Canceled` OU commande annulée (`Refunded`), exactement comme
       * `aggregateTicketingItems` côté trésorerie : les deux écrans doivent tomber d'accord.
       */
      const prixDuBillet = (item: {
        amount: number
        selectedOptions: ReadonlyArray<{ amount: number | null }>
      }) =>
        item.amount + item.selectedOptions.reduce((sum, option) => sum + (option.amount ?? 0), 0)

      const billetAnnule = (order: { status: string }, item: { state: string }) =>
        order.status === 'Refunded' ||
        (ETATS_DE_BILLET_ANNULE as readonly string[]).includes(item.state)

      // Calculer les stats globales en tenant compte des filtres
      let stats = null
      if (!search) {
        const allOrders = await prisma.ticketingOrder.findMany({
          where: filtresSansRecherche,
          select: {
            status: true,
            paymentMethod: true,
            externalTicketingId: true,
            items: {
              // De quoi rejouer les filtres article par article : sans `tierId`, sans
              // `entryValidated` et sans les options, on ne peut que tout compter. `state` et le
              // prix des options servent au montant : un billet annulé ne compte pas, et ses
              // options suivent son sort.
              select: {
                type: true,
                amount: true,
                state: true,
                tierId: true,
                entryValidated: true,
                selectedOptions: { select: { optionId: true, amount: true } },
              },
            },
          },
        })

        let totalItems = 0
        let totalAmount = 0
        let totalDonations = 0
        let totalDonationsAmount = 0
        const amountsByPaymentMethod = {
          cardHelloAsso: 0,
          cardOnsite: 0,
          cash: 0,
          check: 0,
          online: 0,
          pending: 0,
          /**
           * Les billets annulés — commande entière ou billet seul. **Hors du total**, annoncés à
           * part : ils étaient additionnés au « Total général », qui comptait donc deux fois ce
           * qu'il aurait dû retirer. Le nom de la clé reste `refunded` pour les écrans déjà
           * ouverts ; il ne dit PAS que l'argent a été rendu — le filtre « À rembourser » le dit.
           */
          refunded: 0,
        }

        for (const order of allOrders) {
          for (const item of articlesRetenus(order.items, filtresDArticles)) {
            const prix = prixDuBillet(item)

            if (billetAnnule(order, item)) {
              amountsByPaymentMethod.refunded += prix
              continue
            }

            // Un statut inconnu ne rapporte rien, comme en trésorerie : l'additionner au total
            // sans pouvoir le ranger nulle part ferait un détail qui ne retombe plus sur le total.
            if (order.status === 'Pending') amountsByPaymentMethod.pending += prix
            else if (order.status !== 'Processed' && order.status !== 'Onsite') continue
            else if (order.paymentMethod === 'card') {
              // Distinguer carte HelloAsso et carte sur place
              if (order.externalTicketingId) amountsByPaymentMethod.cardHelloAsso += prix
              else amountsByPaymentMethod.cardOnsite += prix
            } else if (order.paymentMethod === 'cash') amountsByPaymentMethod.cash += prix
            else if (order.paymentMethod === 'check') amountsByPaymentMethod.check += prix
            // Payée sans moyen de paiement renseigné
            else amountsByPaymentMethod.online += prix

            totalAmount += prix
            if (item.type === 'Donation') {
              totalDonations += 1
              totalDonationsAmount += prix
            } else {
              totalItems += 1
            }
          }
        }

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
        /**
         * La part de `amount` qui ne rapporte plus : billets annulés, options comprises.
         *
         * `amount` reste ce qui a été payé — c'est lui qu'on rapproche d'un relevé —, mais il ne
         * baisse pas quand on annule un billet : la commande 686 affichait 102 € avec trois de
         * ses cinq tee-shirts annulés. L'écran l'annonce donc à côté, plutôt que de le taire.
         */
        canceledAmount: (order.items ?? []).reduce(
          (sum: number, item: any) => sum + (billetAnnule(order, item) ? prixDuBillet(item) : 0),
          0
        ),
        items: (order.items ?? []).map((item: any) => ({
          ...item,
          retenuParLesFiltres: !triDesArticlesActif || articleRetenu(item, filtresDArticles),
          /**
           * La somme qu'on doit encore pour ce billet, ou `null`.
           *
           * Calculée ici et non à l'écran, pour la même raison qu'au guichet : la règle tient en
           * trois conditions dont une piégeuse — annuler une commande remplace son statut
           * « payée » par « annulée », et seul le moyen de paiement témoigne encore qu'elle
           * l'était. Deux écritures de cette question finiraient par ne plus dire la même chose.
           */
          refundDue: montantARembourser({
            state: item.state,
            refunded: item.refunded,
            amount: item.amount,
            selectedOptions: item.selectedOptions,
            order: { status: order.status, paymentMethod: order.paymentMethod },
          }),
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
