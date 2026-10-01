import { describe, expect, it } from 'vitest'

import { phaseHorsEvenement } from '../../../../../layers/ticketing/app/utils/phases-du-benevole'

/**
 * Le repère qui distingue, au guichet, le bénévole du montage de celui de l'événement.
 *
 * ⚠️ POURQUOI IL EXISTE. Le contrôle d'accès ne retenait que les bénévoles présents PENDANT
 * l'événement : celui qui avait répondu « non » à cette question mais « oui » au montage y était
 * introuvable, par son nom comme par son adresse. La règle serveur a été élargie — il est sur
 * place, il faut bien le faire entrer.
 *
 * Mais le faire apparaître SANS LE DIRE serait un autre défaut : le guichet croirait avoir devant
 * lui un bénévole attendu pendant l'événement. Ce repère est la moitié qui manquerait sinon.
 */
describe('phaseHorsEvenement', () => {
  it('🔬 signale le bénévole du MONTAGE seulement', () => {
    // Le cas signalé : `eventAvailability: false`, `setupAvailability: true`.
    expect(
      phaseHorsEvenement({
        eventAvailability: false,
        setupAvailability: true,
        teardownAvailability: false,
      })
    ).toBe('montage')
  })

  it('🔬 distingue démontage seul et les deux phases', () => {
    expect(
      phaseHorsEvenement({
        eventAvailability: false,
        setupAvailability: false,
        teardownAvailability: true,
      })
    ).toBe('demontage')
    expect(
      phaseHorsEvenement({
        eventAvailability: false,
        setupAvailability: true,
        teardownAvailability: true,
      })
    ).toBe('montage-demontage')
  })

  it('🔬 ne signale RIEN pour qui est présent pendant l’événement', () => {
    /*
     * 📍 On ne marque que l'exception. Une pastille sur chaque ligne ne se lirait plus, et le
     * guichet cesserait de la voir — ce qui reviendrait à ne pas l'avoir mise.
     */
    expect(
      phaseHorsEvenement({
        eventAvailability: true,
        setupAvailability: true,
        teardownAvailability: true,
      })
    ).toBeNull()
  })

  it('🔬 ne signale rien quand la question n’a jamais été posée', () => {
    /*
     * ⚠️ LA DISTINCTION QUE TOUT CE DOSSIER PROTÈGE. `null` veut dire « on ne lui a pas demandé » —
     * la colonne est postérieure à ces candidatures —, `false` veut dire « il a répondu non ».
     * Marquer un `null` « montage seulement » désignerait à tort des bénévoles historiques comme
     * absents de l'événement, alors que personne ne leur a posé la question.
     */
    expect(phaseHorsEvenement({ eventAvailability: null })).toBeNull()
    expect(phaseHorsEvenement({})).toBeNull()
  })

  it('ne signale rien d’une candidature absente', () => {
    expect(phaseHorsEvenement(null)).toBeNull()
    expect(phaseHorsEvenement(undefined)).toBeNull()
  })

  it('n’invente pas de phase quand il n’y en a aucune', () => {
    // « Non » aux trois questions : le serveur ne devrait pas l'avoir rendu. Mieux vaut ne rien
    // afficher que d'annoncer une phase à laquelle la personne n'est pas attendue.
    expect(
      phaseHorsEvenement({
        eventAvailability: false,
        setupAvailability: false,
        teardownAvailability: false,
      })
    ).toBeNull()
  })
})
