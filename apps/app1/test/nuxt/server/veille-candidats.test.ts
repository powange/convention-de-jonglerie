import { describe, it, expect, beforeEach } from 'vitest'

import { enregistrerCandidats, poserVerdict } from '../../../server/utils/veille-candidats'

import type { CandidatExterne } from '../../../server/utils/sources-evenements'

/**
 * Le rangement des candidats de la veille, et surtout l'invariant du refus.
 *
 * ## ⚠️ CE QUE CES CAS PROTÈGENT
 *
 * « Je ne veux pas que ça me le repropose à chaque fois » : un refus posé par un administrateur
 * doit survivre à toutes les énumérations suivantes. L'agenda de JugglingEdge sera relu
 * régulièrement, et il re-listera les mêmes événements — si l'enregistrement réécrivait le
 * verdict, chaque passage ramènerait ce qu'on vient d'écarter, et la fonctionnalité ne servirait
 * à rien.
 *
 * Le piège est discret : il suffit qu'un jour quelqu'un « simplifie » l'`upsert` en réutilisant
 * l'objet de création pour la mise à jour. Rien ne casserait, rien ne serait signalé, et les refus
 * s'effaceraient en silence au prochain balayage. D'où un cas qui regarde la FORME de l'appel et
 * non seulement son résultat.
 */
// Même forme que les autres tests de ce dossier : le bouchon est posé par `test/setup-common.ts`.
const prismaMock = (globalThis as any).prisma

const candidat = (surcharges: Partial<CandidatExterne> = {}): CandidatExterne => ({
  url: 'https://jugglingedge.com/event.php?EventID=6542',
  identifiantSource: '6542',
  titre: 'HerfstJongleerWeekend 2026',
  debut: '2026-10-30',
  jours: 3,
  pays: 'Pays-Bas',
  lieu: 'Drienerlolaan 5',
  adresse: 'Drienerlolaan 5, 7522NB Enschede',
  ...surcharges,
})

describe('enregistrerCandidats', () => {
  beforeEach(() => {
    prismaMock.candidatEvenement.findUnique.mockReset()
    prismaMock.candidatEvenement.upsert.mockReset().mockResolvedValue({})
  })

  it('le témoin : la base est RÉELLEMENT sollicitée', async () => {
    /*
     * Sans ce cas, les suivants seraient verts sur une fonction qui ne ferait rien — le bilan
     * étant calculé sur place, un `upsert` jamais appelé ne se verrait pas dans le compte.
     */
    prismaMock.candidatEvenement.findUnique.mockResolvedValue(null)

    await enregistrerCandidats('jugglingedge', [candidat()])

    expect(prismaMock.candidatEvenement.upsert).toHaveBeenCalledTimes(1)
  })

  it('⚠️ ne réécrit JAMAIS le verdict d’un candidat déjà connu', async () => {
    /*
     * LE cas. On regarde la forme de l'appel : l'objet `update` ne doit pas porter `verdict`, de
     * sorte qu'un `REFUSE` en base y survive. Vérifier le résultat ne suffirait pas — le bouchon
     * rend ce qu'on lui dit de rendre.
     */
    prismaMock.candidatEvenement.findUnique.mockResolvedValue({ id: 7 })

    await enregistrerCandidats('jugglingedge', [candidat()])

    const appel = prismaMock.candidatEvenement.upsert.mock.calls[0]![0]
    expect(appel.update, 'la mise à jour ne doit pas toucher au verdict').not.toHaveProperty(
      'verdict'
    )
    expect(appel.update, 'ni à la date du verdict').not.toHaveProperty('verdictLe')
    // Et elle rafraîchit bien ce que la source DÉCRIT.
    expect(appel.update).toMatchObject({ titre: 'HerfstJongleerWeekend 2026', jours: 3 })
  })

  it('📍 cherche par l’URL canonique, et par rien d’autre', async () => {
    /*
     * Ni le titre ni les dates : un agenda qui corrige une orthographe ou décale un événement d'un
     * jour ne doit pas créer un second candidat, ce qui ferait réapparaître ce qu'on avait écarté.
     */
    prismaMock.candidatEvenement.findUnique.mockResolvedValue(null)

    await enregistrerCandidats('jugglingedge', [candidat({ titre: 'Nom corrigé' })])

    const appel = prismaMock.candidatEvenement.upsert.mock.calls[0]![0]
    expect(appel.where).toEqual({ url: 'https://jugglingedge.com/event.php?EventID=6542' })
  })

  it('compte séparément ce qui est nouveau et ce qui est rafraîchi', async () => {
    prismaMock.candidatEvenement.findUnique
      .mockResolvedValueOnce(null) // le premier est inconnu
      .mockResolvedValueOnce({ id: 7 }) // le second est déjà là

    const bilan = await enregistrerCandidats('jugglingedge', [
      candidat({ url: 'https://jugglingedge.com/event.php?EventID=1' }),
      candidat({ url: 'https://jugglingedge.com/event.php?EventID=2' }),
    ])

    expect(bilan).toEqual({ nouveaux: 1, rafraichis: 1 })
  })

  it('convertit la date de début en Date, et accepte son absence', async () => {
    prismaMock.candidatEvenement.findUnique.mockResolvedValue(null)

    await enregistrerCandidats('jugglingedge', [candidat(), candidat({ debut: null })])

    const premier = prismaMock.candidatEvenement.upsert.mock.calls[0]![0]
    const second = prismaMock.candidatEvenement.upsert.mock.calls[1]![0]
    expect(premier.create.debut).toBeInstanceOf(Date)
    expect((premier.create.debut as Date).toISOString()).toBe('2026-10-30T00:00:00.000Z')
    // Une liste qui ne donne pas la date ne doit pas produire une Date invalide.
    expect(second.create.debut).toBeNull()
  })

  it('range la source avec le candidat', async () => {
    prismaMock.candidatEvenement.findUnique.mockResolvedValue(null)

    await enregistrerCandidats('jugglingedge', [candidat()])

    expect(prismaMock.candidatEvenement.upsert.mock.calls[0]![0].create.source).toBe('jugglingedge')
  })
})

describe('poserVerdict', () => {
  beforeEach(() => {
    prismaMock.candidatEvenement.update.mockReset().mockResolvedValue({})
  })

  it('écrit le verdict ET sa date', async () => {
    /*
     * `verdictLe` dit quand la DÉCISION a été prise, là où `majLe` ne dit que quand la ligne a
     * bougé — un rafraîchissement de description, par exemple. Les confondre ferait croire qu'une
     * décision est récente alors que seule la source a parlé.
     */
    await poserVerdict('https://jugglingedge.com/event.php?EventID=6542', 'REFUSE')

    const appel = prismaMock.candidatEvenement.update.mock.calls[0]![0]
    expect(appel.where).toEqual({ url: 'https://jugglingedge.com/event.php?EventID=6542' })
    expect(appel.data.verdict).toBe('REFUSE')
    expect(appel.data.verdictLe).toBeInstanceOf(Date)
  })

  it('accepte les trois verdicts de l’énumération', async () => {
    for (const verdict of ['A_EXAMINER', 'CONVENTION', 'REFUSE'] as const) {
      await poserVerdict('https://exemple.invalid/e', verdict)
    }

    expect(
      prismaMock.candidatEvenement.update.mock.calls.map((appel) => appel[0].data.verdict)
    ).toEqual(['A_EXAMINER', 'CONVENTION', 'REFUSE'])
  })
})
