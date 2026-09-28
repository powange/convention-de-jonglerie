import { describe, it, expect } from 'vitest'

import { decisionSuppression } from '../../../../../layers/ticketing/server/utils/synchronisation-helloasso'

const tarif = (id: number, helloAssoTierId: number | null, name = `Tarif ${id}`) => ({
  id,
  name,
  helloAssoTierId,
})

/** L'espèce « tarif » : clé numérique. */
const ESPECE_TARIF = {
  cle: (t: { helloAssoTierId: number | null }) => t.helloAssoTierId,
  rienDeRecu: 'aucun tarif',
}

const option = (id: number, helloAssoOptionId: string | null, name = `Option ${id}`) => ({
  id,
  name,
  helloAssoOptionId,
})

/** L'espèce « option » : clé en CHAÎNE, et c'est ce que la généralisation devait absorber. */
const ESPECE_OPTION = {
  cle: (o: { helloAssoOptionId: string | null }) => o.helloAssoOptionId,
  rienDeRecu: 'aucune option',
}

describe('decisionSuppression', () => {
  it('ne supprime rien quand tout est renvoyé', () => {
    const existants = [tarif(1, 100), tarif(2, 200)]
    expect(decisionSuppression(existants, new Set([100, 200]), ESPECE_TARIF).aSupprimer).toEqual([])
  })

  it('supprime un tarif réellement retiré chez HelloAsso', () => {
    const existants = [tarif(1, 100), tarif(2, 200)]
    const { aSupprimer, refus } = decisionSuppression(existants, new Set([100]), ESPECE_TARIF)
    expect(aSupprimer.map((t) => t.id)).toEqual([2])
    expect(refus).toBeUndefined()
  })

  // Le cas qui motive tout : une réponse vide ne prouve pas que les tarifs ont disparu, et la
  // suppression emporterait en cascade quotas, articles et champs personnalisés associés.
  it('refuse de tout supprimer quand HelloAsso ne renvoie rien', () => {
    const existants = [tarif(1, 100), tarif(2, 200)]
    const { aSupprimer, refus } = decisionSuppression(existants, new Set(), ESPECE_TARIF)
    expect(aSupprimer).toEqual([])
    expect(refus).toContain('aucun tarif')
  })

  it('laisse intacts les tarifs créés à la main', () => {
    // Sans identifiant HelloAsso, un tarif n'a jamais été synchronisé : il n'appartient pas à
    // cette comparaison.
    const existants = [tarif(1, null), tarif(2, 200)]
    expect(decisionSuppression(existants, new Set([200]), ESPECE_TARIF).aSupprimer).toEqual([])
  })

  it('n’invoque pas le refus quand il n’y avait rien à supprimer', () => {
    const existants = [tarif(1, null)]
    const { aSupprimer, refus } = decisionSuppression(existants, new Set(), ESPECE_TARIF)
    expect(aSupprimer).toEqual([])
    expect(refus).toBeUndefined()
  })

  it('nomme l’espèce dans son refus', () => {
    // Le message est journalisé tel quel : « aucun tarif » pour l'un, « aucune option » pour l'autre — le genre est porté par l'appelant.
    const { refus } = decisionSuppression([option(1, '900')], new Set(), ESPECE_OPTION)
    expect(refus).toContain('aucune option')
  })

  it('applique la règle aux options, dont la clé est une CHAÎNE', () => {
    /*
     * Le cœur de la généralisation. Les tarifs portent un identifiant numérique, les options une
     * chaîne : une garde recopiée pour les options aurait très bien pu comparer un nombre à une
     * chaîne et ne jamais rien trouver — l'inverse du défaut, aussi silencieux.
     */
    const existantes = [option(1, '900'), option(2, '901')]

    expect(
      decisionSuppression(existantes, new Set(['900', '901']), ESPECE_OPTION).aSupprimer
    ).toEqual([])

    const retiree = decisionSuppression(existantes, new Set(['900']), ESPECE_OPTION)
    expect(retiree.aSupprimer.map((o) => o.id)).toEqual([2])

    const vide = decisionSuppression(existantes, new Set(), ESPECE_OPTION)
    expect(vide.aSupprimer).toEqual([])
    expect(vide.refus).toContain('aucune option')
  })

  it('rend les lignes reçues, et non une projection', () => {
    // L'appelant lit ensuite `.id` pour supprimer et `.name` pour journaliser : la fonction ne doit
    // pas lui rendre des objets appauvris.
    const existantes = [option(1, '900', 'Tee-shirt'), option(2, '901', 'Gourde')]
    const { aSupprimer } = decisionSuppression(existantes, new Set(['900']), ESPECE_OPTION)

    expect(aSupprimer[0]).toBe(existantes[1])
    expect(aSupprimer[0]?.name).toBe('Gourde')
  })

  it('accepte une forte diminution, qui reste un geste légitime', () => {
    // Passer de cinq tarifs à un seul est banal : seul le cas « aucun » est traité comme suspect.
    const existants = [tarif(1, 1), tarif(2, 2), tarif(3, 3), tarif(4, 4), tarif(5, 5)]
    const { aSupprimer, refus } = decisionSuppression(existants, new Set([1]), ESPECE_TARIF)
    expect(aSupprimer.map((t) => t.id)).toEqual([2, 3, 4, 5])
    expect(refus).toBeUndefined()
  })
})
