import { describe, it, expect } from 'vitest'

import { decisionSuppression } from '../../../../../layers/ticketing/server/utils/synchronisation-helloasso'

const tarif = (id: number, helloAssoTierId: number | null, name = `Tarif ${id}`) => ({
  id,
  name,
  helloAssoTierId,
})

describe('decisionSuppression', () => {
  it('ne supprime rien quand tout est renvoyé', () => {
    const existants = [tarif(1, 100), tarif(2, 200)]
    expect(decisionSuppression(existants, new Set([100, 200])).aSupprimer).toEqual([])
  })

  it('supprime un tarif réellement retiré chez HelloAsso', () => {
    const existants = [tarif(1, 100), tarif(2, 200)]
    const { aSupprimer, refus } = decisionSuppression(existants, new Set([100]))
    expect(aSupprimer.map((t) => t.id)).toEqual([2])
    expect(refus).toBeUndefined()
  })

  // Le cas qui motive tout : une réponse vide ne prouve pas que les tarifs ont disparu, et la
  // suppression emporterait en cascade quotas, articles et champs personnalisés associés.
  it('refuse de tout supprimer quand HelloAsso ne renvoie rien', () => {
    const existants = [tarif(1, 100), tarif(2, 200)]
    const { aSupprimer, refus } = decisionSuppression(existants, new Set())
    expect(aSupprimer).toEqual([])
    expect(refus).toContain('aucun tarif')
  })

  it('laisse intacts les tarifs créés à la main', () => {
    // Sans identifiant HelloAsso, un tarif n'a jamais été synchronisé : il n'appartient pas à
    // cette comparaison.
    const existants = [tarif(1, null), tarif(2, 200)]
    expect(decisionSuppression(existants, new Set([200])).aSupprimer).toEqual([])
  })

  it('n’invoque pas le refus quand il n’y avait rien à supprimer', () => {
    const existants = [tarif(1, null)]
    const { aSupprimer, refus } = decisionSuppression(existants, new Set())
    expect(aSupprimer).toEqual([])
    expect(refus).toBeUndefined()
  })

  it('accepte une forte diminution, qui reste un geste légitime', () => {
    // Passer de cinq tarifs à un seul est banal : seul le cas « aucun » est traité comme suspect.
    const existants = [tarif(1, 1), tarif(2, 2), tarif(3, 3), tarif(4, 4), tarif(5, 5)]
    const { aSupprimer, refus } = decisionSuppression(existants, new Set([1]))
    expect(aSupprimer.map((t) => t.id)).toEqual([2, 3, 4, 5])
    expect(refus).toBeUndefined()
  })
})
