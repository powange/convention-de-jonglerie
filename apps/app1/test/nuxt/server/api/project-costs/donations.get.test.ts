import { describe, it, expect, vi, beforeEach } from 'vitest'

// `wrapApiHandler` et `prisma` arrivent par l'auto-import de Nitro : sans ce relais, le fichier
// n'est pas montable et l'échec arrive AU CHARGEMENT, avant qu'aucun cas ne s'exécute.
vi.hoisted(() => {
  if (!(globalThis as any).wrapApiHandler) {
    ;(globalThis as any).wrapApiHandler = (handler: any) => handler
  }
})

import handler from '../../../../../server/api/project-costs/donations.get'

const prismaMock = (globalThis as any).prisma

/**
 * Ce que la page des coûts annonce des dons — constat B4.
 *
 * ## Le défaut
 *
 * Stripe ne livre les frais d'un paiement qu'après un délai qui peut atteindre une heure, et
 * `feeCents`/`netCents` restent nuls en attendant — **définitivement** si le second événement
 * n'arrive jamais. Or `_sum` de Prisma **ignore les valeurs nulles** : `totalNetCents` excluait ces
 * dons alors que `totalCents` les comptait, et l'écran affichait la DIFFÉRENCE sous le libellé
 * « frais Stripe ».
 *
 * Un donateur de 10 € lisait donc **« − 10,00 € frais Stripe »**, et le solde omettait son don.
 *
 * ## 📍 CE QUE LA MESURE DIT DE L'ÉTENDUE
 *
 * Base de développement : **9 dons, aucun en attente de frais**. Le défaut n'est donc pas visible
 * en permanence — il l'est pendant l'heure qui suit chaque don, et pour toujours sur un don dont
 * le second webhook a échoué. C'est aussi pourquoi aucune sonde ne l'aurait trouvé.
 *
 * ## ⚠️ DEUX AGRÉGATS SUR LE MÊME MODÈLE, et c'est le piège du harnais
 *
 * Le bouchon central **ignore le `where`** : il faut donc répondre selon ce qui est DEMANDÉ, et non
 * selon l'ordre des appels — sans quoi les deux agrégats reçoivent la même réponse et le test
 * mesure n'importe quoi. C'est le même piège que les deux `findMany` du guichet.
 */
const expenses = { findMany: () => [] }

/** Le second agrégat est celui qui porte `where: { netCents: null }`. */
const reponses = {
  global: {} as Record<string, unknown>,
  enAttente: {} as Record<string, unknown>,
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.stripeConfig.findFirst.mockResolvedValue({ id: 1 })
  prismaMock.projectExpense.findMany.mockResolvedValue(expenses.findMany())
  prismaMock.timeEstimateConfig.findFirst.mockResolvedValue(null)
  prismaMock.coffeeDonation.aggregate.mockImplementation(async (args: any) =>
    args?.where?.netCents === null ? reponses.enAttente : reponses.global
  )
})

/** 3 dons : 30 € bruts. Deux ont leurs frais (20 € bruts, 19,32 € nets, 0,68 € de frais). */
const avecUnDonEnAttente = () => {
  reponses.global = {
    _sum: { quantity: 3, totalCents: 3000, netCents: 1932, feeCents: 68 },
    _count: 3,
  }
  // Le troisième, 10 €, attend encore ses frais.
  reponses.enAttente = { _sum: { totalCents: 1000 }, _count: 1 }
}

const toutConnu = () => {
  reponses.global = {
    _sum: { quantity: 3, totalCents: 3000, netCents: 2898, feeCents: 102 },
    _count: 3,
  }
  reponses.enAttente = { _sum: { totalCents: null }, _count: 0 }
}

describe('GET /api/project-costs/donations', () => {
  it('⚠️ UN DON EN ATTENTE DE FRAIS EST COMPTÉ AU NET, PAS EN FRAIS', async () => {
    avecUnDonEnAttente()

    const res: any = await handler({} as any)

    // 19,32 € confirmés + 10 € dont les frais sont inconnus = 29,32 €, et non 19,32 €.
    expect(res.totalNetCents).toBe(1932 + 1000)
    // Et les frais annoncés sont ceux de Stripe — pas la différence, qui vaudrait 10,68 €.
    expect(res.totalFeeCents).toBe(68)
    expect(res.totalCents - res.totalNetCents).toBe(68)
  })

  it('dit combien de dons attendent encore leurs frais', async () => {
    avecUnDonEnAttente()

    const res: any = await handler({} as any)

    expect(res.pendingFeeCount).toBe(1)
  })

  it('n’annonce rien à attendre quand tous les frais sont connus', async () => {
    /*
     * LE TÉMOIN. Sans lui, un calcul qui ajouterait TOUJOURS le brut au net satisferait le premier
     * cas — et le montant reçu serait surestimé en permanence, de tous les frais.
     */
    toutConnu()

    const res: any = await handler({} as any)

    expect(res.totalNetCents).toBe(2898)
    expect(res.totalFeeCents).toBe(102)
    expect(res.pendingFeeCount).toBe(0)
  })

  it('⚠️ LE SECOND AGRÉGAT DEMANDE BIEN LES DONS SANS NET CONNU', async () => {
    /*
     * L'assertion qui n'est pas creuse : le bouchon ignorant le `where`, les cas ci-dessus
     * resteraient VERTS si la requête cessait de filtrer sur `netCents: null` — elle rendrait
     * alors le brut de TOUS les dons, qu'on ajouterait au net. C'est la forme de la requête qui
     * porte la preuve.
     */
    toutConnu()

    await handler({} as any)

    expect(prismaMock.coffeeDonation.aggregate).toHaveBeenCalledWith({
      where: { netCents: null },
      _sum: { totalCents: true },
      _count: true,
    })
    // Et le premier agrégat demande bien les frais, sans quoi `totalFeeCents` vaudrait zéro.
    expect(prismaMock.coffeeDonation.aggregate).toHaveBeenCalledWith({
      _sum: { quantity: true, totalCents: true, netCents: true, feeCents: true },
      _count: true,
    })
  })

  it('une base sans aucun don rend des zéros, pas des indéfinis', async () => {
    reponses.global = {
      _sum: { quantity: null, totalCents: null, netCents: null, feeCents: null },
      _count: 0,
    }
    reponses.enAttente = { _sum: { totalCents: null }, _count: 0 }

    const res: any = await handler({} as any)

    expect(res).toMatchObject({
      totalCents: 0,
      totalNetCents: 0,
      totalFeeCents: 0,
      pendingFeeCount: 0,
      totalCoffees: 0,
    })
  })
})
