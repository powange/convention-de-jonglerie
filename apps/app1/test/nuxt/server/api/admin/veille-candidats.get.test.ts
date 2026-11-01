import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * ⚠️ La garde est bouchonnée par `vi.mock` du MODULE, et non par une globale.
 *
 * Le point d'API importe `requireGlobalAdminWithDbCheck` explicitement : poser un bouchon sur
 * `global` ne l'atteint donc pas, la vraie garde s'exécute, et elle tombe sur
 * « requireUserSession is not a function » — un auto-import que les tests ne câblent pas. Les sept
 * cas étaient alors IGNORÉS, pas rouges : le fichier n'arrivait pas à se charger.
 *
 * Et le `vi.mock` doit précéder l'import du gestionnaire, d'où le `vi.hoisted`.
 */
const mockRequireAdmin = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/admin-auth', () => ({
  requireGlobalAdminWithDbCheck: mockRequireAdmin,
}))

import handler from '../../../../../server/api/admin/veille/candidats.get'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * La liste des candidats de la veille, et surtout le calcul « déjà importé ».
 *
 * ## ⚠️ LE CAS QUI PORTE TOUT LE RESTE
 *
 * MESURÉ sur les données réelles : les éditions importées depuis JugglingEdge stockent leur URL
 * d'origine sur `www.jugglingedge.com` ou `fr.jugglingedge.com`, tandis que l'énumération de
 * l'agenda canonicalise sur `jugglingedge.com`, sans sous-domaine. **Trois écritures, un seul
 * événement.**
 *
 * Si le rapprochement ne tenait pas, `dejaImporte` serait toujours `false` et l'écran reproposerait
 * indéfiniment les conventions déjà en base — sans erreur, sans test rouge. Le premier cas ci-dessous
 * éprouve cette chaîne de bout en bout : une édition en `www.` doit marquer un candidat sans
 * sous-domaine.
 */
const candidat = (surcharges: Record<string, unknown> = {}) => ({
  id: 1,
  source: 'jugglingedge',
  url: 'https://jugglingedge.com/event.php?EventID=6485',
  identifiantSource: '6485',
  titre: 'Convention témoin',
  debut: new Date('2026-11-20T00:00:00Z'),
  jours: 3,
  pays: 'Allemagne',
  lieu: null,
  adresse: null,
  verdict: 'A_EXAMINER',
  verdictLe: null,
  decouvertLe: new Date('2026-11-01T00:00:00Z'),
  majLe: new Date('2026-11-01T00:00:00Z'),
  ...surcharges,
})

const appeler = (requete: Record<string, unknown> = {}) => {
  global.getQuery = vi.fn().mockReturnValue(requete)
  return handler({ context: {} } as any) as Promise<any>
}

describe('GET /api/admin/veille/candidats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({ id: 1, isGlobalAdmin: true })
    prismaMock.candidatEvenement.findMany.mockResolvedValue([])
    prismaMock.candidatEvenement.groupBy.mockResolvedValue([])
    // Les comptes par avis : `AUCUN` est compté à part, `groupBy` ne rendant pas de ligne pour
    // les `NULL` sur tous les moteurs.
    prismaMock.candidatEvenement.count.mockResolvedValue(0)
    prismaMock.edition.findMany.mockResolvedValue([])
  })

  it('⚠️ marque « déjà importé » malgré un hôte DIFFÉRENT entre l’agenda et l’édition', async () => {
    prismaMock.candidatEvenement.findMany.mockResolvedValue([candidat()])
    // L'édition porte `www.`, le candidat n'a pas de sous-domaine : une comparaison de chaînes
    // échouerait, et c'est exactement le défaut que le rapprochement par clé évite.
    prismaMock.edition.findMany.mockResolvedValue([
      {
        jugglingEdgeUrl: 'https://www.jugglingedge.com/event.php?EventID=6485',
        facebookUrl: null,
        officialWebsiteUrl: null,
      },
    ])

    const resultat = await appeler()

    expect(resultat.data.candidats[0].dejaImporte).toBe(true)
  })

  it('📍 et reste à `false` pour un événement qui n’est pas en base', async () => {
    /*
     * Sans ce cas, une fonction qui rendrait toujours `true` passerait le précédent — et l'écran
     * masquerait TOUT, ce qui est le sens dangereux : un candidat perdu plutôt que reproposé.
     */
    prismaMock.candidatEvenement.findMany.mockResolvedValue([candidat()])
    prismaMock.edition.findMany.mockResolvedValue([
      {
        jugglingEdgeUrl: 'https://www.jugglingedge.com/event.php?EventID=9999',
        facebookUrl: null,
        officialWebsiteUrl: null,
      },
    ])

    const resultat = await appeler()

    expect(resultat.data.candidats[0].dejaImporte).toBe(false)
  })

  it('📍 lit les TROIS champs d’origine d’une édition, pas seulement JugglingEdge', async () => {
    /*
     * Une convention a pu être importée depuis son site officiel ; l'agenda la liste quand même.
     * Ne regarder qu'un champ reviendrait à la reproposer.
     */
    const appel = prismaMock.edition.findMany
    await appeler()

    const champs = appel.mock.calls[0][0].select
    expect(Object.keys(champs).sort()).toEqual([
      'facebookUrl',
      'jugglingEdgeUrl',
      'officialWebsiteUrl',
    ])
  })

  it('masque les déjà importés quand on le demande', async () => {
    prismaMock.candidatEvenement.findMany.mockResolvedValue([candidat()])
    prismaMock.edition.findMany.mockResolvedValue([
      {
        jugglingEdgeUrl: 'https://fr.jugglingedge.com/event.php?EventID=6485',
        facebookUrl: null,
        officialWebsiteUrl: null,
      },
    ])

    const avec = await appeler()
    const sans = await appeler({ masquerImportes: 'true' })

    expect(avec.data.candidats).toHaveLength(1)
    expect(sans.data.candidats).toHaveLength(0)
  })

  it('ne filtre que sur un verdict CONNU', async () => {
    /*
     * Même règle que les autres écrans d'administration : une valeur inconnue ne filtre pas, plutôt
     * que de rendre une liste vide qu'on prendrait pour « il n'y a rien ».
     */
    await appeler({ verdict: 'REFUSE' })
    expect(prismaMock.candidatEvenement.findMany.mock.calls[0][0].where.verdict).toBe('REFUSE')

    vi.clearAllMocks()
    prismaMock.candidatEvenement.findMany.mockResolvedValue([])
    prismaMock.candidatEvenement.groupBy.mockResolvedValue([])
    prismaMock.edition.findMany.mockResolvedValue([])
    await appeler({ verdict: 'INVENTE' })
    expect(prismaMock.candidatEvenement.findMany.mock.calls[0][0].where).not.toHaveProperty(
      'verdict'
    )
  })

  it('📍 rend TOUTES les sources déclarées, même celles qui n’ont rien rapporté', async () => {
    /*
     * Leur absence du filtre laisserait croire qu'elles ne sont pas branchées.
     */
    const resultat = await appeler()

    expect(resultat.data.sources.map((s: any) => s.cle)).toContain('jugglingedge')
  })

  it('⚠️ traduit `avisIa=AUCUN` en `null`, et non en « pas de filtre »', async () => {
    /*
     * LE cas du lot de classification. `AUCUN` désigne la file des candidats que le modèle n'a pas
     * encore vus — donc le travail qui reste. S'il était confondu avec l'absence de filtre, la
     * requête partirait sans contrainte et l'écran afficherait TOUT : la file des non classés
     * deviendrait inatteignable, donc le reste à faire invisible. Aucune erreur, aucun test rouge.
     */
    await appeler({ avisIa: 'AUCUN' })

    const where = prismaMock.candidatEvenement.findMany.mock.calls[0][0].where
    expect(where).toHaveProperty('avisIa', null)
  })

  it('📍 filtre sur un avis nommé, et ignore un avis inventé', async () => {
    /*
     * Même règle que pour les verdicts : une valeur inconnue ne filtre pas, plutôt que de rendre
     * une liste vide qu'on prendrait pour « il n'y a rien ».
     */
    await appeler({ avisIa: 'HORS_SUJET' })
    expect(prismaMock.candidatEvenement.findMany.mock.calls[0][0].where.avisIa).toBe('HORS_SUJET')

    vi.clearAllMocks()
    prismaMock.candidatEvenement.findMany.mockResolvedValue([])
    prismaMock.candidatEvenement.groupBy.mockResolvedValue([])
    prismaMock.candidatEvenement.count.mockResolvedValue(0)
    prismaMock.edition.findMany.mockResolvedValue([])

    await appeler({ avisIa: 'TOTALEMENT_INVENTE' })
    expect(prismaMock.candidatEvenement.findMany.mock.calls[0][0].where).not.toHaveProperty(
      'avisIa'
    )
  })

  it('📍 compte par verdict sur TOUTE la table, sans les filtres', async () => {
    /*
     * Ces comptes servent d'onglets. Filtrés par eux-mêmes, ils afficheraient toujours le nombre de
     * la liste courante — donc n'informeraient de rien.
     */
    prismaMock.candidatEvenement.groupBy.mockResolvedValue([
      { verdict: 'A_EXAMINER', _count: { _all: 12 } },
      { verdict: 'REFUSE', _count: { _all: 40 } },
    ])

    const resultat = await appeler({ verdict: 'CONVENTION' })

    expect(prismaMock.candidatEvenement.groupBy.mock.calls[0][0]).not.toHaveProperty('where')
    expect(resultat.data.comptes).toEqual({ A_EXAMINER: 12, CONVENTION: 0, REFUSE: 40 })
  })
})
