import { describe, expect, it } from 'vitest'

import { construireFriseProgramme, grouperParJournee } from '../../../shared/utils/program-timeline'

describe('construireFriseProgramme', () => {
  it('réunit les trois sources dans l’ordre chronologique', () => {
    const frise = construireFriseProgramme({
      workshops: [
        {
          id: 1,
          title: 'Jonglerie à 3 balles',
          startDateTime: '2026-09-26T14:00:00.000Z',
          endDateTime: '2026-09-26T15:30:00.000Z',
        },
      ],
      spectacles: [
        {
          id: 1,
          title: 'Gala',
          startDateTime: '2026-09-26T20:00:00.000Z',
          duration: 90,
          isPublic: true,
        },
      ],
      elements: [
        {
          id: 1,
          title: 'Repas du soir',
          startDateTime: '2026-09-26T18:30:00.000Z',
          endDateTime: '2026-09-26T19:30:00.000Z',
          isPublic: true,
        },
      ],
    })

    expect(frise.map((e) => e.titre)).toEqual(['Jonglerie à 3 balles', 'Repas du soir', 'Gala'])
    expect(frise.map((e) => e.source)).toEqual(['workshop', 'element', 'spectacle'])
  })

  /**
   * La règle qui surprendrait sinon : les workshops n'ont aucun état de publication en base et sont
   * déjà publics dès leur création sur leur propre page. Les masquer ici les ferait disparaître
   * d'un programme public sans que personne l'ait demandé.
   */
  it('publie toujours les workshops, faute d’état de publication en base', () => {
    const frise = construireFriseProgramme({
      workshops: [
        {
          id: 7,
          title: 'Workshop',
          startDateTime: '2026-09-26T10:00:00.000Z',
          endDateTime: '2026-09-26T11:00:00.000Z',
        },
      ],
    })
    expect(frise).toHaveLength(1)
    expect(frise[0]!.publie).toBe(true)
  })

  it('écarte les brouillons par défaut, spectacles comme éléments', () => {
    const sources = {
      spectacles: [
        { id: 1, title: 'Gala secret', startDateTime: '2026-09-26T20:00:00.000Z', isPublic: false },
      ],
      elements: [
        {
          id: 1,
          title: 'Repas en préparation',
          startDateTime: '2026-09-26T18:00:00.000Z',
          endDateTime: '2026-09-26T19:00:00.000Z',
          isPublic: false,
        },
      ],
    }

    expect(construireFriseProgramme(sources)).toHaveLength(0)
    expect(construireFriseProgramme(sources, { inclureBrouillons: true })).toHaveLength(2)
  })

  it('marque les brouillons comme tels quand on les inclut', () => {
    const frise = construireFriseProgramme(
      {
        elements: [
          {
            id: 1,
            title: 'Brouillon',
            startDateTime: '2026-09-26T18:00:00.000Z',
            endDateTime: '2026-09-26T19:00:00.000Z',
            isPublic: false,
          },
        ],
      },
      { inclureBrouillons: true }
    )
    expect(frise[0]!.publie).toBe(false)
  })

  // Un spectacle stocke une durée, pas une heure de fin : c'est ce que connaît un programmateur.
  it('déduit la fin d’un spectacle de sa durée', () => {
    const frise = construireFriseProgramme({
      spectacles: [
        {
          id: 1,
          title: 'Gala',
          startDateTime: '2026-09-26T20:00:00.000Z',
          duration: 90,
          isPublic: true,
        },
      ],
    })
    expect(frise[0]!.fin).toBe('2026-09-26T21:30:00.000Z')
  })

  /**
   * Sans durée, on rend `null` plutôt qu'une fin arbitraire : une fin inventée ferait dire à la
   * frise qu'un spectacle est terminé alors que personne n'en sait rien.
   */
  it('laisse la fin vide quand la durée manque ou n’a pas de sens', () => {
    for (const duration of [null, undefined, 0, -30]) {
      const frise = construireFriseProgramme({
        spectacles: [
          {
            id: 1,
            title: 'Gala',
            startDateTime: '2026-09-26T20:00:00.000Z',
            duration,
            isPublic: true,
          },
        ],
      })
      expect(frise[0]!.fin, `durée ${duration}`).toBeNull()
    }
  })

  // Les identifiants se chevauchent d'une source à l'autre : le workshop 3 et le spectacle 3 coexistent.
  it('donne des clés distinctes à des identifiants identiques', () => {
    const frise = construireFriseProgramme({
      workshops: [
        {
          id: 3,
          title: 'A',
          startDateTime: '2026-09-26T10:00:00.000Z',
          endDateTime: '2026-09-26T11:00:00.000Z',
        },
      ],
      spectacles: [
        { id: 3, title: 'B', startDateTime: '2026-09-26T11:00:00.000Z', isPublic: true },
      ],
      elements: [
        {
          id: 3,
          title: 'C',
          startDateTime: '2026-09-26T12:00:00.000Z',
          endDateTime: '2026-09-26T13:00:00.000Z',
          isPublic: true,
        },
      ],
    })
    expect(new Set(frise.map((e) => e.cle)).size).toBe(3)
  })

  // Deux entrées à la même heure doivent garder un ordre stable d'un appel à l'autre.
  it('départage les horaires identiques par le titre', () => {
    const frise = construireFriseProgramme({
      elements: [
        {
          id: 1,
          title: 'Zumba',
          startDateTime: '2026-09-26T10:00:00.000Z',
          endDateTime: '2026-09-26T11:00:00.000Z',
          isPublic: true,
        },
        {
          id: 2,
          title: 'Accueil',
          startDateTime: '2026-09-26T10:00:00.000Z',
          endDateTime: '2026-09-26T11:00:00.000Z',
          isPublic: true,
        },
      ],
    })
    expect(frise.map((e) => e.titre)).toEqual(['Accueil', 'Zumba'])
  })

  it('reprend le lieu de chaque source à sa manière', () => {
    const frise = construireFriseProgramme({
      workshops: [
        {
          id: 1,
          title: 'A',
          startDateTime: '2026-09-26T10:00:00.000Z',
          endDateTime: '2026-09-26T11:00:00.000Z',
          location: { name: 'Gymnase', zoneId: 4, markerId: null },
        },
      ],
      spectacles: [
        {
          id: 1,
          title: 'B',
          startDateTime: '2026-09-26T12:00:00.000Z',
          location: 'Chapiteau',
          markerId: 9,
          isPublic: true,
        },
      ],
      elements: [
        {
          id: 1,
          title: 'C',
          startDateTime: '2026-09-26T13:00:00.000Z',
          endDateTime: '2026-09-26T14:00:00.000Z',
          locationName: 'Devant la buvette',
          zoneId: 2,
          isPublic: true,
        },
      ],
    })
    expect(frise.map((e) => [e.lieu, e.zoneId, e.markerId])).toEqual([
      ['Gymnase', 4, null],
      ['Chapiteau', null, 9],
      ['Devant la buvette', 2, null],
    ])
  })

  /**
   * Tous les moments d'un programme n'annoncent pas de fin — un accueil qui ouvre, une scène
   * ouverte qui dure ce qu'elle dure. On rend `null` plutôt qu'une fin inventée.
   */
  it('accepte un élément sans heure de fin', () => {
    for (const endDateTime of [null, undefined]) {
      const frise = construireFriseProgramme({
        elements: [
          {
            id: 1,
            title: 'Accueil ouvert',
            startDateTime: '2026-10-02T14:00:00.000Z',
            endDateTime,
            isPublic: true,
          },
        ],
      })
      expect(frise[0]!.fin, `fin ${endDateTime}`).toBeNull()
      expect(frise[0]!.debut).toBe('2026-10-02T14:00:00.000Z')
    }
  })

  /**
   * Sans cette reprise, une entrée rattachée à la carte n'affichait aucun lieu — et le lien vers
   * la carte restait invisible faute d'étiquette à cliquer.
   */
  it('nomme le lieu d’après la zone ou le repère quand le texte libre manque', () => {
    const frise = construireFriseProgramme({
      spectacles: [
        {
          id: 1,
          title: 'Gala',
          startDateTime: '2026-10-02T20:00:00.000Z',
          zoneId: 9,
          zone: { name: 'Salle des fêtes' },
          isPublic: true,
        },
      ],
      elements: [
        {
          id: 1,
          title: 'Feu',
          startDateTime: '2026-10-02T22:00:00.000Z',
          markerId: 6,
          marker: { name: 'Esplanade' },
          isPublic: true,
        },
      ],
    })
    expect(frise.map((e) => e.lieu)).toEqual(['Salle des fêtes', 'Esplanade'])
  })

  // Le texte libre est une précision voulue par l'organisateur : il prime sur le nom de la zone.
  it('préfère le texte libre au nom de la zone', () => {
    const frise = construireFriseProgramme({
      elements: [
        {
          id: 1,
          title: 'Apéro',
          startDateTime: '2026-10-02T18:00:00.000Z',
          locationName: 'côté buvette',
          zoneId: 9,
          zone: { name: 'Salle des fêtes' },
          isPublic: true,
        },
      ],
    })
    expect(frise[0]!.lieu).toBe('côté buvette')
  })

  it('accepte des sources absentes', () => {
    expect(construireFriseProgramme({})).toEqual([])
  })
})

describe('grouperParJournee', () => {
  it('regroupe et trie les journées', () => {
    const frise = construireFriseProgramme({
      elements: [
        {
          id: 1,
          title: 'Dimanche',
          startDateTime: '2026-09-28T10:00:00.000Z',
          endDateTime: '2026-09-28T11:00:00.000Z',
          isPublic: true,
        },
        {
          id: 2,
          title: 'Samedi',
          startDateTime: '2026-09-27T10:00:00.000Z',
          endDateTime: '2026-09-27T11:00:00.000Z',
          isPublic: true,
        },
      ],
    })
    const journees = grouperParJournee(frise)
    expect(journees.map((j) => j.date)).toEqual(['2026-09-27', '2026-09-28'])
    expect(journees[0]!.entrees.map((e) => e.titre)).toEqual(['Samedi'])
  })

  /**
   * Une scène ouverte de 23 h appartient à la soirée où le public la vit. Sans le fuseau de
   * l'édition, elle basculait au lendemain dès que le programme était consulté depuis un fuseau
   * plus à l'est, et la frise affichait une journée de trop.
   */
  it('rattache une fin de soirée à la journée vécue sur place', () => {
    const frise = construireFriseProgramme({
      elements: [
        {
          id: 1,
          title: 'Scène ouverte',
          // 23 h à Paris le 27, soit déjà le 28 en temps universel.
          startDateTime: '2026-09-27T21:00:00.000Z',
          isPublic: true,
        },
      ],
    })
    expect(grouperParJournee(frise, 'Europe/Paris').map((j) => j.date)).toEqual(['2026-09-27'])
    expect(grouperParJournee(frise, 'UTC').map((j) => j.date)).toEqual(['2026-09-27'])
    // Depuis Melbourne, ce même instant tombe au lendemain : c'est ce que le fuseau de l'édition
    // évite de faire subir au programme.
    expect(grouperParJournee(frise, 'Australia/Melbourne').map((j) => j.date)).toEqual([
      '2026-09-28',
    ])
  })

  it('rend une liste vide sans entrée', () => {
    expect(grouperParJournee([])).toEqual([])
  })
})
