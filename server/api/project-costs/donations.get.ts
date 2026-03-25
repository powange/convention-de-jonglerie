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

    const [donationsResult, expenses] = await Promise.all([
      prisma.coffeeDonation.aggregate({
        _sum: { quantity: true, totalCents: true, netCents: true },
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
    ])

    // Calculer le coût total cumulé exact depuis le début
    let totalCostCents = 0
    for (const expense of expenses) {
      for (const rate of expense.rates) {
        totalCostCents += Math.round(calculateRateCost(rate) * 100)
      }
    }

    return {
      donationsEnabled: !!stripeConfig,
      totalCoffees: donationsResult._sum.quantity || 0,
      totalDonations: donationsResult._count,
      totalCents: donationsResult._sum.totalCents || 0,
      totalNetCents: donationsResult._sum.netCents || 0,
      totalCostCents,
    }
  },
  { operationName: 'GET project-costs donations' }
)
