import { describe, expect, it } from 'vitest'

import { detecterSpectaclesManques } from '../../../app/utils/spectacles-manques'

const creneau = (options: {
  id?: string
  debut: string
  fin: string
  benevoles?: number[]
  teamId?: string
}) => ({
  id: options.id ?? 'creneau-1',
  title: 'Accueil du public',
  start: options.debut,
  end: options.fin,
  teamId: options.teamId ?? 'equipe-A',
  assignedVolunteersList: (options.benevoles ?? [1]).map((id) => ({
    user: { id, pseudo: `benevole-${id}` },
  })),
})

const spectacle = (options: { duree?: number | null; passages: string[] }) => ({
  id: 7,
  title: 'Cabaret du soir',
  durationMinutes: options.duree ?? 90,
  performances: options.passages.map((startDateTime) => ({ startDateTime })),
})

describe('detecterSpectaclesManques', () => {
  it('signale le bénévole quand l’unique représentation tombe pendant son créneau', () => {
    const avertissements = detecterSpectaclesManques(
      [spectacle({ passages: ['2026-08-01T20:00:00.000Z'] })],
      [creneau({ debut: '2026-08-01T19:00:00.000Z', fin: '2026-08-01T22:00:00.000Z' })]
    )

    expect(avertissements).toHaveLength(1)
    expect(avertissements[0]?.show.title).toBe('Cabaret du soir')
    expect(avertissements[0]?.representations).toHaveLength(1)
  })

  // Le cœur de la demande : plusieurs représentations laissent plusieurs occasions de voir.
  it('ne signale rien tant qu’une seule représentation reste libre', () => {
    const avertissements = detecterSpectaclesManques(
      [spectacle({ passages: ['2026-08-01T20:00:00.000Z', '2026-08-02T20:00:00.000Z'] })],
      [creneau({ debut: '2026-08-01T19:00:00.000Z', fin: '2026-08-01T22:00:00.000Z' })]
    )

    expect(avertissements).toEqual([])
  })

  it('signale quand toutes les représentations sont prises, et nomme chaque créneau bloquant', () => {
    const avertissements = detecterSpectaclesManques(
      [spectacle({ passages: ['2026-08-01T20:00:00.000Z', '2026-08-02T20:00:00.000Z'] })],
      [
        creneau({ id: 'c1', debut: '2026-08-01T19:00:00.000Z', fin: '2026-08-01T22:00:00.000Z' }),
        creneau({ id: 'c2', debut: '2026-08-02T19:00:00.000Z', fin: '2026-08-02T22:00:00.000Z' }),
      ]
    )

    expect(avertissements).toHaveLength(1)
    expect(avertissements[0]?.representations.map((r) => r.slot.id)).toEqual(['c1', 'c2'])
  })

  describe('ce qui compte comme « ne pas voir le spectacle »', () => {
    // Arriver au milieu, ce n'est pas voir le spectacle : le moindre chevauchement suffit.
    it('signale un créneau qui ne mord que sur la fin', () => {
      const avertissements = detecterSpectaclesManques(
        [spectacle({ duree: 90, passages: ['2026-08-01T20:00:00.000Z'] })],
        [creneau({ debut: '2026-08-01T21:00:00.000Z', fin: '2026-08-01T23:00:00.000Z' })]
      )

      expect(avertissements).toHaveLength(1)
    })

    it('ne signale pas un créneau qui s’achève à l’heure pile du lever de rideau', () => {
      const avertissements = detecterSpectaclesManques(
        [spectacle({ passages: ['2026-08-01T20:00:00.000Z'] })],
        [creneau({ debut: '2026-08-01T18:00:00.000Z', fin: '2026-08-01T20:00:00.000Z' })]
      )

      expect(avertissements).toEqual([])
    })

    it('ne signale pas un créneau qui commence quand le spectacle se termine', () => {
      const avertissements = detecterSpectaclesManques(
        [spectacle({ duree: 60, passages: ['2026-08-01T20:00:00.000Z'] })],
        [creneau({ debut: '2026-08-01T21:00:00.000Z', fin: '2026-08-01T23:00:00.000Z' })]
      )

      expect(avertissements).toEqual([])
    })
  })

  describe('spectacles sans durée renseignée', () => {
    // Un tiers des spectacles n'a pas de durée : on ne peut alors juger que sur l'heure de début.
    it('signale le créneau déjà en cours au lever de rideau', () => {
      const avertissements = detecterSpectaclesManques(
        [spectacle({ duree: null, passages: ['2026-08-01T20:00:00.000Z'] })],
        [creneau({ debut: '2026-08-01T19:00:00.000Z', fin: '2026-08-01T21:00:00.000Z' })]
      )

      expect(avertissements).toHaveLength(1)
    })

    it('signale le créneau qui commence à l’heure pile du lever de rideau', () => {
      const avertissements = detecterSpectaclesManques(
        [spectacle({ duree: null, passages: ['2026-08-01T20:00:00.000Z'] })],
        [creneau({ debut: '2026-08-01T20:00:00.000Z', fin: '2026-08-01T21:00:00.000Z' })]
      )

      expect(avertissements).toHaveLength(1)
    })

    it('ne signale pas un créneau qui s’achève avant le lever de rideau', () => {
      const avertissements = detecterSpectaclesManques(
        [spectacle({ duree: null, passages: ['2026-08-01T20:00:00.000Z'] })],
        [creneau({ debut: '2026-08-01T18:00:00.000Z', fin: '2026-08-01T20:00:00.000Z' })]
      )

      expect(avertissements).toEqual([])
    })
  })

  it('juge chaque bénévole séparément', () => {
    const avertissements = detecterSpectaclesManques(
      [spectacle({ passages: ['2026-08-01T20:00:00.000Z'] })],
      [
        creneau({
          id: 'c1',
          debut: '2026-08-01T19:00:00.000Z',
          fin: '2026-08-01T22:00:00.000Z',
          benevoles: [1],
        }),
        creneau({
          id: 'c2',
          debut: '2026-08-01T10:00:00.000Z',
          fin: '2026-08-01T12:00:00.000Z',
          benevoles: [2],
        }),
      ]
    )

    expect(avertissements.map((a) => a.volunteerId)).toEqual([1])
  })

  it('nomme l’équipe du créneau bloquant quand on sait la résoudre', () => {
    const avertissements = detecterSpectaclesManques(
      [spectacle({ passages: ['2026-08-01T20:00:00.000Z'] })],
      [
        creneau({
          debut: '2026-08-01T19:00:00.000Z',
          fin: '2026-08-01T22:00:00.000Z',
          teamId: 'equipe-A',
        }),
      ],
      (teamId) => (teamId === 'equipe-A' ? 'Accueil' : null)
    )

    expect(avertissements[0]?.representations[0]?.slot.teamName).toBe('Accueil')
  })

  it('ne dit rien d’un bénévole sans créneau', () => {
    expect(
      detecterSpectaclesManques([spectacle({ passages: ['2026-08-01T20:00:00.000Z'] })], [])
    ).toEqual([])
  })

  it('ignore un spectacle sans représentation plutôt que de le signaler à tout le monde', () => {
    const avertissements = detecterSpectaclesManques(
      [spectacle({ passages: [] })],
      [creneau({ debut: '2026-08-01T19:00:00.000Z', fin: '2026-08-01T22:00:00.000Z' })]
    )

    expect(avertissements).toEqual([])
  })

  // Accuser sur des dates illisibles serait pire que se taire.
  it('ignore un créneau aux dates aberrantes', () => {
    const avertissements = detecterSpectaclesManques(
      [spectacle({ passages: ['2026-08-01T20:00:00.000Z'] })],
      [creneau({ debut: 'pas une date', fin: '2026-08-01T22:00:00.000Z' })]
    )

    expect(avertissements).toEqual([])
  })

  it('signale séparément deux spectacles également manqués', () => {
    const avertissements = detecterSpectaclesManques(
      [
        { ...spectacle({ passages: ['2026-08-01T20:00:00.000Z'] }), id: 1, title: 'Cabaret' },
        { ...spectacle({ passages: ['2026-08-01T20:30:00.000Z'] }), id: 2, title: 'Feu' },
      ],
      [creneau({ debut: '2026-08-01T19:00:00.000Z', fin: '2026-08-01T23:00:00.000Z' })]
    )

    expect(avertissements.map((a) => a.show.title)).toEqual(['Cabaret', 'Feu'])
  })
})
