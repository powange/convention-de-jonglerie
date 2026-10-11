/**
 * Calcule le coût exact d'un tarif.
 *
 * - MONTHLY : proportionnel au nombre de mois écoulés (paiement récurrent)
 * - YEARLY : montant complet pour chaque année entamée (payé d'avance)
 * - ONE_TIME : montant complet dès la date de début
 *
 * Les tarifs dont la date de début est dans le futur ne sont pas comptés.
 */
function calculateRateCost(rate: {
  amount: any
  period: string
  startDate: Date
  endDate: Date | null
}): number {
  const amount = parseFloat(String(rate.amount))
  const start = new Date(rate.startDate)
  const now = new Date()

  // Tarif pas encore commencé → 0
  if (start > now) return 0

  if (rate.period === 'ONE_TIME') {
    return amount
  }

  if (rate.period === 'YEARLY') {
    // Payé d'avance : compter le montant complet pour chaque année entamée
    const end = rate.endDate ? new Date(rate.endDate) : now
    const effectiveEnd = end > now ? now : end
    const diffMs = effectiveEnd.getTime() - start.getTime()
    const years = diffMs / (1000 * 60 * 60 * 24 * 365.25)
    return Math.ceil(Math.max(0, years)) * amount
  }

  if (rate.period === 'MONTHLY') {
    // Proportionnel au nombre de mois écoulés
    const end = rate.endDate ? new Date(rate.endDate) : now
    const effectiveEnd = end > now ? now : end
    const months =
      (effectiveEnd.getFullYear() - start.getFullYear()) * 12 +
      (effectiveEnd.getMonth() - start.getMonth()) +
      (effectiveEnd.getDate() - start.getDate()) / 30
    return Math.max(0, months) * amount
  }

  return 0
}

export default wrapApiHandler(
  async () => {
    // Vérifier si Stripe est configuré et actif
    const stripeConfig = await prisma.stripeConfig.findFirst({
      where: { isActive: true },
      select: { id: true },
    })

    const [donationsResult, fraisEnAttente, expenses, timeEstimate] = await Promise.all([
      prisma.coffeeDonation.aggregate({
        _sum: { quantity: true, totalCents: true, netCents: true, feeCents: true },
        _count: true,
      }),
      /*
       * ⚠️ LES DONS DONT LES FRAIS NE SONT PAS ENCORE CONNUS — constat B4.
       *
       * Stripe ne livre la « balance transaction » qu'après un délai qui peut atteindre une heure
       * (c'est écrit dans le webhook), et `feeCents`/`netCents` restent donc NULS en attendant —
       * définitivement si le second événement n'arrive jamais. Or `_sum` de Prisma IGNORE les
       * valeurs nulles : `totalNetCents` excluait ces dons alors que `totalCents` les comptait, et
       * l'écran affichait la différence sous le libellé « frais Stripe ». Un donateur de 10 € lisait
       * donc « − 10,00 € de frais Stripe », et le solde l'omettait purement et simplement.
       *
       * On relève ici leur montant BRUT, pour le compter au net à défaut de mieux : un don reçu est
       * un don reçu, et le pire des deux approximations est de le présenter comme des frais.
       *
       * 📍 La condition porte sur `netCents` et non sur `feeCents` : c'est `netCents` qui manque au
       * calcul. Les deux sont de toute façon écrits ENSEMBLE, depuis la même balance transaction.
       */
      prisma.coffeeDonation.aggregate({
        where: { netCents: null },
        _sum: { totalCents: true },
        _count: true,
      }),
      prisma.projectExpense.findMany({
        where: { isActive: true },
        include: {
          rates: {
            orderBy: { startDate: 'asc' },
          },
        },
      }),
      prisma.timeEstimateConfig.findFirst(),
    ])

    // Calculer le coût total cumulé exact depuis le début
    let totalCostCents = 0
    for (const expense of expenses) {
      for (const rate of expense.rates) {
        totalCostCents += Math.round(calculateRateCost(rate) * 100)
      }
    }

    // Calcul du temps estimé
    let estimatedHours: number | null = null
    if (timeEstimate) {
      const refDate = new Date(timeEstimate.referenceDate)
      const now = new Date()
      const weeksSinceRef = Math.max(
        0,
        (now.getTime() - refDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
      )
      estimatedHours = Math.round(
        parseFloat(String(timeEstimate.fixedHours)) +
          weeksSinceRef * parseFloat(String(timeEstimate.weeklyHours))
      )
    }

    return {
      donationsEnabled: !!stripeConfig,
      totalCoffees: donationsResult._sum.quantity || 0,
      totalDonations: donationsResult._count,
      totalCents: donationsResult._sum.totalCents || 0,
      /*
       * Le net = ce que Stripe a confirmé, PLUS le brut des dons dont les frais sont encore
       * inconnus. On surestime donc le net de quelques centimes pendant ce court moment — l'écart
       * est celui des frais à venir — là où l'ancien calcul retranchait le don ENTIER.
       */
      totalNetCents: (donationsResult._sum.netCents || 0) + (fraisEnAttente._sum.totalCents || 0),
      /** Les frais réellement connus. C'est eux que l'écran annonce, et non une différence. */
      totalFeeCents: donationsResult._sum.feeCents || 0,
      /** Combien de dons attendent encore leurs frais, pour que l'écran puisse le dire. */
      pendingFeeCount: fraisEnAttente._count,
      totalCostCents,
      estimatedHours,
    }
  },
  { operationName: 'GET project-costs donations' }
)
