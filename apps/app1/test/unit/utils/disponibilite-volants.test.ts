import { describe, expect, it } from 'vitest'

import {
  creneauEnCours,
  etatDuVolant,
  prochainCreneau,
  resumeDesRenforts,
  volantsParDisponibilite,
} from '../../../shared/utils/disponibilite-volants'

/**
 * Qui peut prêter main-forte, maintenant.
 *
 * L'écran est consulté dans l'urgence : ce qu'il affiche doit être vrai à la minute près, et la
 * distinction entre « occupé » et « absent » doit tenir — l'un se libérera, l'autre peut-être
 * jamais.
 */
const MAINTENANT = new Date('2026-08-01T18:00:00Z')

const creneau = (debut: string, fin: string) => ({ debut, fin })

/** Un créneau qui englobe l'instant de référence. */
const enCours = creneau('2026-08-01T17:00:00Z', '2026-08-01T20:00:00Z')
const passe = creneau('2026-08-01T10:00:00Z', '2026-08-01T12:00:00Z')
const aVenir = creneau('2026-08-01T21:00:00Z', '2026-08-01T23:00:00Z')

describe('creneauEnCours', () => {
  it('trouve le créneau qui englobe l’instant', () => {
    expect(creneauEnCours([passe, enCours, aVenir], MAINTENANT)).toBe(enCours)
  })

  it('libère à l’heure pile de fin', () => {
    // Borne de fin EXCLUE : quelqu'un dont le créneau s'achève à 18 h est libre à 18 h. L'inverse
    // le laisserait occupé une minute de trop, à chaque relève.
    const finitMaintenant = creneau('2026-08-01T15:00:00Z', '2026-08-01T18:00:00Z')
    expect(creneauEnCours([finitMaintenant], MAINTENANT)).toBeNull()
  })

  it('occupe dès l’heure pile de début', () => {
    const commenceMaintenant = creneau('2026-08-01T18:00:00Z', '2026-08-01T20:00:00Z')
    expect(creneauEnCours([commenceMaintenant], MAINTENANT)).toBe(commenceMaintenant)
  })

  it('ignore les bornes absurdes', () => {
    // Une fin avant le début, ou une date illisible : mieux vaut ne rien dire que déclarer
    // quelqu'un occupé sur la foi d'une donnée cassée.
    expect(
      creneauEnCours([creneau('2026-08-01T20:00:00Z', '2026-08-01T17:00:00Z')], MAINTENANT)
    ).toBeNull()
    expect(creneauEnCours([creneau('pas une date', 'non plus')], MAINTENANT)).toBeNull()
  })

  it('ne se plaint pas d’une liste absente', () => {
    expect(creneauEnCours([], MAINTENANT)).toBeNull()
    expect(creneauEnCours(null, MAINTENANT)).toBeNull()
    expect(creneauEnCours(undefined, MAINTENANT)).toBeNull()
  })
})

describe('prochainCreneau', () => {
  it('rend le plus proche de ceux qui restent', () => {
    const plusTard = creneau('2026-08-01T23:30:00Z', '2026-08-02T01:00:00Z')
    expect(prochainCreneau([plusTard, aVenir, passe], MAINTENANT)).toBe(aVenir)
  })

  it('ignore le créneau en cours, qui n’est pas « à venir »', () => {
    expect(prochainCreneau([enCours], MAINTENANT)).toBeNull()
  })

  it('rend null quand plus rien n’attend', () => {
    expect(prochainCreneau([passe], MAINTENANT)).toBeNull()
  })
})

describe('etatDuVolant', () => {
  it('dit « disponible » quand la personne est là et libre', () => {
    expect(etatDuVolant({ entreeValidee: true, creneaux: [passe] }, MAINTENANT)).toBe('disponible')
  })

  it('dit « occupé » quand un créneau la mobilise', () => {
    expect(etatDuVolant({ entreeValidee: true, creneaux: [enCours] }, MAINTENANT)).toBe('occupe')
  })

  it('dit « absent » tant que l’entrée n’est pas validée', () => {
    expect(etatDuVolant({ entreeValidee: false, creneaux: [] }, MAINTENANT)).toBe('absent')
    expect(etatDuVolant({ creneaux: [] }, MAINTENANT)).toBe('absent')
    expect(etatDuVolant({ entreeValidee: null }, MAINTENANT)).toBe('absent')
  })

  it('fait primer l’absence sur l’occupation', () => {
    // Le point important : un créneau posé sur quelqu'un qui n'est pas arrivé ne dit rien de sa
    // présence. Le déclarer « occupé » ferait croire qu'il travaille quelque part.
    expect(etatDuVolant({ entreeValidee: false, creneaux: [enCours] }, MAINTENANT)).toBe('absent')
  })
})

describe('volantsParDisponibilite', () => {
  it('met ceux qu’on peut appeler en premier, les absents en dernier', () => {
    const volants = [
      { id: 'absent', entreeValidee: false, creneaux: [] },
      { id: 'occupe', entreeValidee: true, creneaux: [enCours] },
      { id: 'libre', entreeValidee: true, creneaux: [passe] },
    ]

    expect(volantsParDisponibilite(volants, MAINTENANT).map((v) => v.id)).toEqual([
      'libre',
      'occupe',
      'absent',
    ])
  })

  it('ne modifie pas la liste reçue', () => {
    const volants = [
      { id: 'occupe', entreeValidee: true, creneaux: [enCours] },
      { id: 'libre', entreeValidee: true, creneaux: [] },
    ]
    volantsParDisponibilite(volants, MAINTENANT)

    expect(volants[0]!.id).toBe('occupe')
  })
})

describe('resumeDesRenforts', () => {
  it('compte les trois états séparément', () => {
    const resume = resumeDesRenforts(
      [
        { entreeValidee: true, creneaux: [] },
        { entreeValidee: true, creneaux: [passe] },
        { entreeValidee: true, creneaux: [enCours] },
        { entreeValidee: false, creneaux: [] },
      ],
      MAINTENANT
    )

    expect(resume).toEqual({ disponibles: 2, occupes: 1, absents: 1, total: 4 })
  })

  it('rend des zéros sans volants', () => {
    expect(resumeDesRenforts([], MAINTENANT)).toEqual({
      disponibles: 0,
      occupes: 0,
      absents: 0,
      total: 0,
    })
  })
})
