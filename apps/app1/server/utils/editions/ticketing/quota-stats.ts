export interface QuotaStats {
  id: number
  title: string
  description: string | null
  quantity: number
  currentCount: number
  validatedCount: number
  percentage: number
}

/**
 * Calcule les statistiques d'utilisation des quotas pour une édition
 */
export async function getQuotaStats(editionId: number): Promise<QuotaStats[]> {
  // Récupérer tous les quotas de l'édition avec leurs tarifs, options et custom fields associés
  const quotas = await prisma.ticketingQuota.findMany({
    where: { editionId },
    include: {
      tiers: {
        include: {
          tier: {
            include: {
              orderItems: {
                where: {
                  state: { in: ['Processed', 'Pending'] }, // Billets payés et en attente
                },
              },
            },
          },
        },
      },
      // L'identifiant suffit : le rapprochement se fait par clé étrangère, plus par le nom.
      options: {
        select: { optionId: true },
      },
      customFields: {
        include: {
          customField: true,
        },
      },
      // Dans les trois cas, une clé nulle vaut « tous », et une clé renseignée vise un
      // sous-ensemble : un organisateur nommé, une équipe de bénévoles, un spectacle.
      organizers: {
        select: { organizerId: true },
      },
      volunteers: {
        select: { teamId: true },
      },
      artists: {
        select: { showId: true },
      },
    },
    orderBy: { position: 'asc' },
  })

  // Récupérer tous les order items avec leurs customFields pour analyser les options
  // On inclut les billets payés (Processed) et en attente de paiement (Pending)
  // On inclut les billets externes (HelloAsso) ET manuels
  const allOrderItems = await prisma.ticketingOrderItem.findMany({
    where: {
      state: { in: ['Processed', 'Pending'] },
      order: {
        editionId: editionId,
      },
    },
    select: {
      id: true,
      customFields: true,
      entryValidated: true,
    },
  })

  /**
   * Les options réellement prises, par billet.
   *
   * Lues dans `TicketingOrderItemOption`, la table de liaison — et non dans l'instantané JSON du
   * billet, où le calcul les cherchait autrefois et où elles ne sont JAMAIS : les deux chemins
   * d'écriture les en excluent explicitement. Un quota posé sur une option comptait donc zéro,
   * quel que soit le nombre de billets. Mesuré avant correction sur la base de développement :
   * 149 options vendues, aucun billet trouvé.
   *
   * Le rapprochement se fait par `optionId`. Renommer une option ne détache donc plus rien,
   * contrairement à la comparaison de noms qu'il remplace.
   *
   * Même filtre d'état que le reste du calcul : une option prise sur un billet annulé n'occupe
   * pas de place.
   */
  const optionsPrises = await prisma.ticketingOrderItemOption.findMany({
    where: {
      orderItem: {
        state: { in: ['Processed', 'Pending'] },
        order: { editionId },
      },
    },
    select: {
      optionId: true,
      orderItem: { select: { id: true, entryValidated: true } },
    },
  })

  /** Les billets qui ont pris telle option. */
  const billetsParOption = new Map<number, Array<{ id: number; entryValidated: boolean }>>()
  for (const prise of optionsPrises) {
    const existants = billetsParOption.get(prise.optionId)
    if (existants) existants.push(prise.orderItem)
    else billetsParOption.set(prise.optionId, [prise.orderItem])
  }

  /**
   * Les personnes présentes sur l'édition sans passer par un billet.
   *
   * Trois familles — organisateurs, bénévoles, artistes — qui posent toutes la même question et
   * appellent le même traitement : qui est là, qui est arrivé, et qui appartient à tel
   * sous-ensemble. Elles sont donc ramenées à une forme commune plutôt que traitées trois fois de
   * suite, ce qui aurait fini par diverger au premier correctif appliqué d'un seul côté.
   *
   * Règle commune, arrêtée avec l'utilisateur : une personne INSCRITE occupe sa place
   * immédiatement, comme un billet compte dès la vente ; la validation de son entrée l'ajoute
   * ENSUITE aux validés, sans rien changer au total utilisé.
   */
  interface FamilleDePersonnes<C> {
    /** Tous les identifiants de la famille, pour une association globale. */
    tous: number[]
    /** Ceux dont l'entrée est validée. */
    valides: Set<number>
    /** Les identifiants rattachés à une clé : un organisateur, une équipe, un spectacle. */
    parCle: Map<C, number[]>
  }

  const organisateurs = await prisma.editionOrganizer.findMany({
    where: { editionId },
    select: { id: true, entryValidated: true },
  })

  /**
   * Les bénévoles ACCEPTÉS, et eux seuls : une candidature en attente n'est pas une venue
   * décidée. Même règle que `personnes-edition.ts`, qui refuse pour cette raison de proposer les
   * candidatures en attente.
   *
   * `eventId` et non `editionId` : les candidatures sont rattachées à l'`Event`. Les deux
   * identifiants coïncident sur toutes les éditions existantes, et c'est la convention suivie
   * partout dans le dépôt.
   */
  const benevoles = await prisma.editionVolunteerApplication.findMany({
    where: { eventId: editionId, status: 'ACCEPTED' },
    select: {
      id: true,
      entryValidated: true,
      teamAssignments: { select: { teamId: true } },
    },
  })

  /**
   * Les artistes, et les spectacles auxquels ils participent.
   *
   * `ShowArtist.showId` est renseigné même quand l'artiste passe par un numéro de cabaret — le
   * schéma le dit explicitement : c'est lui qui répond à « à quels spectacles cet artiste
   * participe-t-il ? ». Une seule requête suffit donc, sans passer par les numéros.
   */
  const artistes = await prisma.editionArtist.findMany({
    where: { editionId },
    select: {
      id: true,
      entryValidated: true,
      shows: { select: { showId: true } },
    },
  })

  const grouper = <C>(
    personnes: Array<{ id: number; entryValidated: boolean }>,
    cles: (personne: any) => C[]
  ): FamilleDePersonnes<C> => {
    const parCle = new Map<C, number[]>()
    for (const personne of personnes) {
      for (const cle of cles(personne)) {
        const existants = parCle.get(cle)
        if (existants) existants.push(personne.id)
        else parCle.set(cle, [personne.id])
      }
    }
    return {
      tous: personnes.map((personne) => personne.id),
      valides: new Set(personnes.filter((p) => p.entryValidated).map((p) => p.id)),
      parCle,
    }
  }

  const familleOrganisateurs = grouper<number>(organisateurs, (organisateur) => [organisateur.id])
  const familleBenevoles = grouper<string>(benevoles, (benevole) =>
    benevole.teamAssignments.map((assignation: { teamId: string }) => assignation.teamId)
  )
  const familleArtistes = grouper<number>(artistes, (artiste) =>
    artiste.shows.map((participation: { showId: number }) => participation.showId)
  )

  /**
   * Les personnes qu'une liste d'associations désigne.
   *
   * Un `Set`, et c'est le point : il dédoublonne la personne visée à la fois globalement et
   * nommément, celle qui appartient à deux équipes associées au même quota, ou l'artiste qui joue
   * dans deux spectacles associés au même quota. Chaque personne occupe une place, pas deux.
   */
  const personnesVisees = <C>(
    associations: Array<C | null>,
    famille: FamilleDePersonnes<C>
  ): Set<number> => {
    const visees = new Set<number>()
    for (const cle of associations) {
      if (cle === null) for (const id of famille.tous) visees.add(id)
      else for (const id of famille.parCle.get(cle) ?? []) visees.add(id)
    }
    return visees
  }

  const compterLesValides = <C>(visees: Set<number>, famille: FamilleDePersonnes<C>): number => {
    let total = 0
    for (const id of visees) if (famille.valides.has(id)) total++
    return total
  }

  // Calculer les stats pour chaque quota
  return quotas.map((quota) => {
    // Utiliser des Sets pour éviter de compter plusieurs fois le même billet
    const matchingOrderItemIds = new Set<number>()
    const validatedOrderItemIds = new Set<number>()

    // 1. Compter les participants via les tarifs
    for (const tierQuota of quota.tiers) {
      for (const orderItem of tierQuota.tier.orderItems) {
        matchingOrderItemIds.add(orderItem.id)
        if (orderItem.entryValidated) {
          validatedOrderItemIds.add(orderItem.id)
        }
      }
    }

    // 2. Compter les billets via les options qu'ils ont prises.
    for (const optionQuota of quota.options) {
      for (const billet of billetsParOption.get(optionQuota.optionId) ?? []) {
        // Le même ensemble que les tarifs : un billet est UNE place, qu'il soit retenu par son
        // tarif, par une option, ou par les deux.
        matchingOrderItemIds.add(billet.id)
        if (billet.entryValidated) {
          validatedOrderItemIds.add(billet.id)
        }
      }
    }

    // 3. Compter les participants via les custom fields (champs personnalisés de tarifs)
    for (const customFieldQuota of quota.customFields) {
      const customFieldLabel = customFieldQuota.customField.label
      const choiceValue = customFieldQuota.choiceValue

      for (const orderItem of allOrderItems) {
        if (orderItem.customFields && Array.isArray(orderItem.customFields)) {
          // Vérifier si cet orderItem a ce custom field avec le bon choix
          const hasCustomField = (orderItem.customFields as any[]).some((field) => {
            if (field.name !== customFieldLabel) {
              return false
            }

            // Si choiceValue est null, on compte tous les participants qui ont répondu à ce champ
            if (choiceValue === null) {
              return !!field.answer
            }

            // Sinon, on vérifie que la réponse correspond au choix spécifique
            return field.answer === choiceValue
          })

          if (hasCustomField) {
            matchingOrderItemIds.add(orderItem.id)
            if (orderItem.entryValidated) {
              validatedOrderItemIds.add(orderItem.id)
            }
          }
        }
      }
    }

    /**
     * 4. Compter les personnes présentes : organisateurs, bénévoles, artistes.
     *
     * Un ensemble PAR FAMILLE, et c'est indispensable : tous ces identifiants sont des entiers
     * bruts issus de tables différentes. Les mêler ferait que le bénévole nº 5 écrase
     * l'organisateur nº 5, et le total perdrait une unité sans que rien ne le signale.
     *
     * En revanche rien ne rapproche ces personnes d'un billet qu'elles auraient acheté par
     * ailleurs, ni une même personne d'une famille à l'autre : elle compterait alors deux fois.
     * Décidé ainsi — le billet ne porte qu'une adresse de courriel, jamais un compte, et ce
     * rapprochement échouerait en silence dès qu'elle achète sous une autre adresse.
     */
    const organisateursVises = personnesVisees(
      quota.organizers.map((association) => association.organizerId),
      familleOrganisateurs
    )
    const benevolesVises = personnesVisees(
      quota.volunteers.map((association) => association.teamId),
      familleBenevoles
    )
    const artistesVises = personnesVisees(
      quota.artists.map((association) => association.showId),
      familleArtistes
    )

    // Convertir les Sets en nombre
    const currentCount =
      matchingOrderItemIds.size + organisateursVises.size + benevolesVises.size + artistesVises.size

    const validatedCount =
      validatedOrderItemIds.size +
      compterLesValides(organisateursVises, familleOrganisateurs) +
      compterLesValides(benevolesVises, familleBenevoles) +
      compterLesValides(artistesVises, familleArtistes)

    const percentage = quota.quantity > 0 ? Math.round((currentCount / quota.quantity) * 100) : 0

    return {
      id: quota.id,
      title: quota.title,
      description: quota.description,
      quantity: quota.quantity,
      currentCount,
      validatedCount,
      percentage,
    }
  })
}
