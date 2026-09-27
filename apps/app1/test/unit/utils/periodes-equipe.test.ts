import { describe, expect, it } from 'vitest'

import {
  equipeCouvreAuMoinsUnePeriode,
  equipeRecoupeLesDisponibilites,
  equipesProposables,
  periodesDeLEquipe,
} from '../../../shared/utils/periodes-equipe'

/**
 * Les périodes d'une équipe, et ce qu'on propose au candidat.
 *
 * Une équipe n'intervient pas forcément sur toute la convention. Le formulaire de candidature ne
 * doit donc proposer, dans les équipes préférées, que celles dont une période recoupe les
 * disponibilités annoncées — et le serveur doit refuser les autres, faute de quoi la règle du
 * navigateur ne serait que décorative.
 *
 * Ces tests portent sur la règle partagée par les deux. Si elle se trompe, elle se trompe des deux
 * côtés à la fois, et personne ne le voit.
 */

const equipe = (p: Partial<Record<'coversSetup' | 'coversEvent' | 'coversTeardown', boolean>>) => ({
  coversSetup: false,
  coversEvent: false,
  coversTeardown: false,
  ...p,
})

const dispos = (
  p: Partial<
    Record<'setupAvailability' | 'eventAvailability' | 'teardownAvailability', boolean | null>
  >
) => ({
  setupAvailability: false,
  eventAvailability: false,
  teardownAvailability: false,
  ...p,
})

describe('periodesDeLEquipe', () => {
  it('rend les périodes cochées, dans l’ordre chronologique', () => {
    expect(periodesDeLEquipe(equipe({ coversTeardown: true, coversSetup: true }))).toEqual([
      'SETUP',
      'TEARDOWN',
    ])
  })

  it('rend une liste vide quand rien n’est coché', () => {
    expect(periodesDeLEquipe(equipe({}))).toEqual([])
  })
})

describe('equipeCouvreAuMoinsUnePeriode', () => {
  it('refuse une équipe qui ne couvre rien', () => {
    // État incohérent : elle ne serait proposée à personne, sans que rien ne l'explique à
    // l'organisateur qui l'a créée. Les deux points d'API s'appuient sur cette fonction.
    expect(equipeCouvreAuMoinsUnePeriode(equipe({}))).toBe(false)
  })

  it('accepte dès qu’une seule période est cochée', () => {
    expect(equipeCouvreAuMoinsUnePeriode(equipe({ coversEvent: true }))).toBe(true)
  })
})

describe('equipeRecoupeLesDisponibilites', () => {
  it('suffit d’UNE période commune', () => {
    /*
     * Le sens du recoupement, et c'est le piège de cette règle : on ne demande PAS que l'équipe
     * soit entièrement couverte par les disponibilités. Exiger cela écarterait les équipes
     * présentes partout — c'est-à-dire presque toutes — pour qui ne vient qu'au montage.
     */
    const partout = equipe({ coversSetup: true, coversEvent: true, coversTeardown: true })

    expect(equipeRecoupeLesDisponibilites(partout, dispos({ setupAvailability: true }))).toBe(true)
  })

  it('écarte une équipe dont aucune période ne correspond', () => {
    const auDemontage = equipe({ coversTeardown: true })

    expect(equipeRecoupeLesDisponibilites(auDemontage, dispos({ setupAvailability: true }))).toBe(
      false
    )
  })

  it('traite une disponibilité jamais renseignée comme « pas disponible »', () => {
    // `null` en base sur une candidature ancienne : le même parti que `isVolunteerEligibleForMeal`.
    const auMontage = equipe({ coversSetup: true })

    expect(equipeRecoupeLesDisponibilites(auMontage, dispos({ setupAvailability: null }))).toBe(
      false
    )
    expect(equipeRecoupeLesDisponibilites(auMontage, {})).toBe(false)
  })

  it('n’accepte jamais une équipe sans période, même pour un candidat disponible partout', () => {
    const vide = equipe({})
    const partout = dispos({
      setupAvailability: true,
      eventAvailability: true,
      teardownAvailability: true,
    })

    expect(equipeRecoupeLesDisponibilites(vide, partout)).toBe(false)
  })
})

describe('equipesProposables', () => {
  const accueil = { id: 'a', coversSetup: false, coversEvent: true, coversTeardown: false }
  const chantier = { id: 'b', coversSetup: true, coversEvent: false, coversTeardown: true }
  const partout = { id: 'c', coversSetup: true, coversEvent: true, coversTeardown: true }

  it('ne garde que les équipes qui recoupent les disponibilités', () => {
    const proposees = equipesProposables(
      [accueil, chantier, partout],
      dispos({ setupAvailability: true })
    )

    expect(proposees.map((e) => e.id)).toEqual(['b', 'c'])
  })

  it('ne filtre PAS tant qu’aucune disponibilité n’est cochée', () => {
    /*
     * Le formulaire s'ouvre avec les trois cases vides. Filtrer à cet instant viderait la liste,
     * ferait disparaître le champ, puis le ferait surgir de nulle part au premier clic. Ne rien
     * avoir coché n'est pas un choix, c'est un formulaire encore vierge.
     */
    const proposees = equipesProposables([accueil, chantier, partout], dispos({}))

    expect(proposees.map((e) => e.id)).toEqual(['a', 'b', 'c'])
  })

  it('peut ne rien proposer du tout — c’est ce qui masque le champ', () => {
    const proposees = equipesProposables([accueil], dispos({ teardownAvailability: true }))

    expect(proposees).toEqual([])
  })

  it('rend les objets d’origine, pour que l’appelant garde ses autres champs', () => {
    // Le formulaire lit ensuite `isRequired` et `name` sur ces mêmes objets.
    const proposees = equipesProposables([partout], dispos({ eventAvailability: true }))

    expect(proposees[0]).toBe(partout)
  })
})
