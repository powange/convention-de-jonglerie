import { describe, expect, it } from 'vitest'

import {
  finDuBenevolat,
  visibiliteDuBenevolat,
  type SituationDuBenevolat,
} from '../../../server/utils/visibilite-benevoles'

/**
 * La fermeture automatique du bénévolat.
 *
 * Une édition recrute pendant le montage, pendant l'événement et pendant le démontage : ce qui
 * doit fermer, c'est ce qui vient après. Le défaut que ces tests empêchent n'est pas l'oubli de
 * fermer — il se voit — mais la fermeture d'un jour trop tôt, qui couperait le recrutement le
 * dernier jour du démontage sans que personne ne comprenne pourquoi.
 */

const situation = (champs: Partial<SituationDuBenevolat> = {}): SituationDuBenevolat => ({
  open: true,
  pagePublic: true,
  finDemontage: null,
  finEdition: '2026-06-10',
  maintenant: new Date('2026-06-01T12:00:00Z'),
  ...champs,
})

describe('finDuBenevolat', () => {
  it('couvre le dernier jour en entier', () => {
    // Ces dates viennent d'un calendrier et sont stockées à minuit. S'arrêter à minuit fermerait
    // tout le dernier jour du démontage — le contrôle de période des créneaux ajoute déjà ce jour
    // pour la même raison, et cette borne doit être la sienne.
    const fin = finDuBenevolat(situation({ finEdition: '2026-06-10T00:00:00Z' }))
    expect(fin?.toISOString()).toBe('2026-06-11T00:00:00.000Z')
  })

  it('préfère la fin du démontage à celle de l’édition', () => {
    const fin = finDuBenevolat(
      situation({ finEdition: '2026-06-10T00:00:00Z', finDemontage: '2026-06-12T00:00:00Z' })
    )
    expect(fin?.toISOString()).toBe('2026-06-13T00:00:00.000Z')
  })

  it('retient la plus tardive même quand le démontage est saisi avant la fin', () => {
    // Saisie incohérente : prendre le démontage au mot fermerait le recrutement PENDANT
    // l'événement. Se tromper dans l'autre sens ne coûte qu'une page ouverte trop longtemps.
    const fin = finDuBenevolat(
      situation({ finEdition: '2026-06-10T00:00:00Z', finDemontage: '2026-06-02T00:00:00Z' })
    )
    expect(fin?.toISOString()).toBe('2026-06-11T00:00:00.000Z')
  })

  it('se replie sur la fin de l’édition quand aucun démontage n’est déclaré', () => {
    expect(finDuBenevolat(situation({ finDemontage: null }))).not.toBeNull()
    expect(finDuBenevolat(situation({ finDemontage: '' }))).not.toBeNull()
  })

  it('ne date rien quand rien n’est datable', () => {
    expect(finDuBenevolat(situation({ finEdition: null, finDemontage: null }))).toBeNull()
    expect(finDuBenevolat(situation({ finEdition: undefined, finDemontage: undefined }))).toBeNull()
  })

  it('ignore une date illisible plutôt que de rendre une borne invalide', () => {
    // `new Date('n’importe quoi')` rend un objet Date dont getTime() est NaN. Comparé à quoi que
    // ce soit, il est toujours faux — la règle laisserait donc l'édition ouverte pour toujours
    // sans jamais le dire. Autant traiter l'illisible comme une absence.
    expect(finDuBenevolat(situation({ finEdition: 'pas une date', finDemontage: null }))).toBeNull()
    const fin = finDuBenevolat(
      situation({ finEdition: '2026-06-10T00:00:00Z', finDemontage: 'pas une date' })
    )
    expect(fin?.toISOString()).toBe('2026-06-11T00:00:00.000Z')
  })

  it('accepte aussi bien un objet Date qu’une chaîne', () => {
    const avecChaine = finDuBenevolat(situation({ finEdition: '2026-06-10T00:00:00Z' }))
    const avecDate = finDuBenevolat(situation({ finEdition: new Date('2026-06-10T00:00:00Z') }))
    expect(avecDate?.toISOString()).toBe(avecChaine?.toISOString())
  })
})

describe('visibiliteDuBenevolat', () => {
  it('laisse tout ouvert pendant l’édition', () => {
    const v = visibiliteDuBenevolat(
      situation({
        maintenant: new Date('2026-06-05T12:00:00Z'),
        finEdition: '2026-06-10T00:00:00Z',
      })
    )
    expect(v).toEqual({ open: true, pagePublic: true, terminee: false })
  })

  it('laisse tout ouvert le dernier jour du démontage', () => {
    // Le cas qui justifie ces tests : à 23 h le jour de la fin du démontage, on recrute encore.
    const v = visibiliteDuBenevolat(
      situation({
        maintenant: new Date('2026-06-12T23:00:00Z'),
        finDemontage: '2026-06-12T00:00:00Z',
      })
    )
    expect(v.terminee).toBe(false)
    expect(v.open).toBe(true)
  })

  it('ferme les candidatures ET retire la page publique une fois le démontage fini', () => {
    const v = visibiliteDuBenevolat(
      situation({
        maintenant: new Date('2026-06-13T00:00:00Z'),
        finDemontage: '2026-06-12T00:00:00Z',
      })
    )
    expect(v).toEqual({ open: false, pagePublic: false, terminee: true })
  })

  it('n’ouvre jamais ce que l’organisateur a fermé', () => {
    // La règle ne sait que fermer. Une édition à venir dont le recrutement n'est pas encore
    // annoncé doit le rester.
    const v = visibiliteDuBenevolat(
      situation({ open: false, pagePublic: false, maintenant: new Date('2026-06-01T00:00:00Z') })
    )
    expect(v).toEqual({ open: false, pagePublic: false, terminee: false })
  })

  it('ne ferme rien sur une édition qu’aucune date ne situe', () => {
    // Une édition en cours de création. Fermer sur la foi d'une absence reviendrait à décider à
    // la place de l'organisateur.
    const v = visibiliteDuBenevolat(
      situation({ finEdition: null, finDemontage: null, maintenant: new Date('2030-01-01') })
    )
    expect(v).toEqual({ open: true, pagePublic: true, terminee: false })
  })

  it('annonce « terminée » même quand tout était déjà fermé à la main', () => {
    // `terminee` décrit l'édition, pas les booléens : un appelant doit pouvoir distinguer
    // « l'organisateur n'a pas encore ouvert » de « c'est passé ».
    const v = visibiliteDuBenevolat(
      situation({
        open: false,
        pagePublic: false,
        maintenant: new Date('2027-01-01'),
        finEdition: '2026-06-10T00:00:00Z',
      })
    )
    expect(v.terminee).toBe(true)
  })
})
