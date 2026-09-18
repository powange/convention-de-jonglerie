import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it } from 'vitest'

import SlotDetailsModal from '../../../../../../layers/volunteers/app/components/edition/volunteer/planning/SlotDetailsModal.vue'

/**
 * Cette modale montrait l'heure ENREGISTRÉE d'un créneau, sans jamais appliquer son décalage.
 *
 * C'est pourtant celle qu'on ouvre pour vérifier un horaire dont on doute — et le calendrier,
 * juste derrière, affichait déjà l'heure décalée. Deux réponses contradictoires à la même
 * question, la moins fiable étant donnée au geste le plus délibéré.
 *
 * Le créneau est écrit en UTC explicite : sans le `Z`, ces tests dépendraient du fuseau de la
 * machine qui les exécute.
 */
const EQUIPES = [{ id: 'accueil', name: 'Accueil', color: '#3b82f6' }]

// Ces deux modales chargent leurs listes au montage. On les sert vides : ce n'est pas ce qu'on
// éprouve ici, et un 404 non simulé noierait la sortie des tests.
registerEndpoint('/api/editions/22/volunteer-time-slots/creneau-1/assignments', () => [])
registerEndpoint('/api/editions/22/volunteers/available', () => [])

let monte: { unmount: () => void } | null = null
afterEach(() => {
  monte?.unmount()
  monte = null
})

const monter = async (delayMinutes: number | null) => {
  const wrapper = await mountSuspended(SlotDetailsModal, {
    props: {
      modelValue: true,
      readOnly: true,
      teams: EQUIPES,
      timeSlot: {
        id: 'creneau-1',
        title: 'Accueil du matin',
        startDateTime: '2026-10-02T12:00:00.000Z',
        endDateTime: '2026-10-02T14:00:00.000Z',
        teamId: 'accueil',
        maxVolunteers: 3,
        assignedVolunteers: 0,
        delayMinutes,
        assignedVolunteersList: [],
      },
    },
  })
  monte = wrapper
  // Le corps de la modale est téléporté hors du composant : c'est le document qu'on interroge.
  return document.body.textContent ?? ''
}

/** Les heures lues dans le rendu, dans leur ordre d'apparition. */
const heures = (texte: string) => [...texte.matchAll(/(\d{2}):(\d{2})/g)].map((m) => m[0])

/** La première heure du rendu, en minutes depuis minuit, que la locale l'écrive en 24 h ou AM/PM. */
const premiereHeure24 = (texte: string) => {
  const trouve = texte.match(/(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i)
  if (!trouve) return null
  let heure = Number(trouve[1])
  const meridien = trouve[3]?.toUpperCase()
  if (meridien === 'PM' && heure !== 12) heure += 12
  if (meridien === 'AM' && heure === 12) heure = 0
  return heure * 60 + Number(trouve[2])
}

const enMinutes = (heure: string) => {
  const [h, m] = heure.split(':').map(Number)
  return h! * 60 + m!
}

describe('SlotDetailsModal — le décalage du créneau', () => {
  it('décale de 30 minutes les heures annoncées', async () => {
    // L'écart est mesuré entre deux rendus plutôt que comparé à une heure écrite en dur : le
    // fuseau du conteneur de test ne doit pas décider du résultat.
    const sansDecalage = heures(await monter(null))
    monte?.unmount()
    monte = null
    const avecDecalage = heures(await monter(30))

    expect(enMinutes(avecDecalage[0]!) - enMinutes(sansDecalage[0]!)).toBe(30)
    expect(enMinutes(avecDecalage[1]!) - enMinutes(sansDecalage[1]!)).toBe(30)
  })

  it("rappelle l'horaire PRÉVU à côté du nouveau", async () => {
    // Le nouveau, puis le prévu qu'on barre : quatre heures au total, les deux dernières étant
    // celles d'origine.
    const lues = heures(await monter(30))

    expect(lues).toHaveLength(4)
    expect(enMinutes(lues[0]!) - enMinutes(lues[2]!)).toBe(30)
  })

  it('distingue un retard d’une avance', async () => {
    // `t` rend la clé telle quelle dans les tests : c'est donc le SENS choisi qu'on vérifie ici,
    // pas le libellé traduit.
    expect(await monter(30)).toContain('volunteers.delay_minutes')
    monte?.unmount()
    monte = null
    expect(await monter(-30)).toContain('volunteers.advance_minutes')
  })

  it('ne parle pas de décalage quand il n’y en a pas', async () => {
    const texte = await monter(null)

    expect(heures(texte)).toHaveLength(2)
    expect(texte).not.toContain('volunteers.delay_minutes')
    expect(texte).not.toContain('volunteers.advance_minutes')
  })
})

/**
 * Deux exigences venues de l'usage réel, une fois la modale ouverte depuis la page publique.
 */
describe('SlotDetailsModal — contenu et mise en page', () => {
  const monterAvec = async (supplement: Record<string, unknown>) => {
    const wrapper = await mountSuspended(SlotDetailsModal, {
      props: {
        modelValue: true,
        readOnly: true,
        teams: EQUIPES,
        timeSlot: {
          id: 'creneau-1',
          title: 'Accueil du matin',
          startDateTime: '2026-10-02T12:00:00.000Z',
          endDateTime: '2026-10-02T14:00:00.000Z',
          teamId: 'accueil',
          maxVolunteers: 3,
          assignedVolunteers: 0,
          delayMinutes: null,
          assignedVolunteersList: [],
          ...supplement,
        },
      },
    })
    monte = wrapper
    return wrapper
  }

  it('nomme les organisateurs affectés au créneau', async () => {
    // Ils tiennent le créneau comme les bénévoles et occupent une place dans le compteur. La
    // page publique les laissait tomber en composant le créneau pour la modale : un créneau
    // tenu par deux organisateurs y paraissait vide.
    await monterAvec({
      assignedOrganizersList: [
        { editionOrganizerId: 7, user: { pseudo: 'clairb', prenom: 'Claire', nom: 'Bernard' } },
      ],
    })

    expect(document.body.textContent).toContain('clairb')
  })

  it('empile les deux dates sur mobile', async () => {
    // Deux dates complètes côte à côte se coupaient en plein milieu sur un téléphone. Une seule
    // colonne en dessous du point de rupture, deux au-delà.
    await monterAvec({})

    // Le corps de la modale est téléporté hors du composant : c'est le document qu'on interroge.
    const grille = [...document.body.querySelectorAll('[class*="grid-cols"]')].map(
      (n) => n.className
    )
    expect(grille.length).toBeGreaterThan(0)
    expect(grille.some((c) => c.includes('grid-cols-1') && c.includes('sm:grid-cols-2'))).toBe(true)
    expect(grille.some((c) => /(^|\s)grid-cols-2(\s|$)/.test(c))).toBe(false)
  })
})

/**
 * La modale annonçait l'heure du NAVIGATEUR pendant que la liste d'où l'on venait de cliquer
 * annonçait celle du lieu. Le geste le plus délibéré — ouvrir le détail pour vérifier — donnait
 * la réponse la moins fiable.
 */
describe('SlotDetailsModal — fuseau de l’édition', () => {
  const monterDans = async (fuseau: string | null) => {
    const wrapper = await mountSuspended(SlotDetailsModal, {
      props: {
        modelValue: true,
        readOnly: true,
        teams: EQUIPES,
        fuseau,
        timeSlot: {
          id: 'creneau-1',
          title: 'Accueil du matin',
          startDateTime: '2026-10-02T12:00:00.000Z',
          endDateTime: '2026-10-02T14:00:00.000Z',
          teamId: 'accueil',
          maxVolunteers: 3,
          assignedVolunteers: 0,
          delayMinutes: null,
          assignedVolunteersList: [],
        },
      },
    })
    monte = wrapper
    return document.body.textContent ?? ''
  }

  it('annonce des heures différentes selon le fuseau de l’édition', async () => {
    // L'écart entre deux fuseaux éloignés ne peut pas être vrai par hasard, quel que soit le
    // fuseau de la machine qui exécute la suite.
    const paris = await monterDans('Europe/Paris')
    monte?.unmount()
    monte = null
    const tokyo = await monterDans('Asia/Tokyo')

    expect(heures(paris)[0]).not.toBe(heures(tokyo)[0])
  })

  it('lit 12:00 UTC comme 14 h à Paris et 21 h à Tokyo', async () => {
    // Lu en minutes depuis minuit plutôt qu'en chaîne : la modale suit la locale de la personne,
    // et le format horaire (24 h ou AM/PM) ne doit pas décider du sort de ce test.
    expect(premiereHeure24(await monterDans('Europe/Paris'))).toBe(14 * 60)
    monte?.unmount()
    monte = null
    expect(premiereHeure24(await monterDans('Asia/Tokyo'))).toBe(21 * 60)
  })
})

describe('SlotDetailsModal — la couleur de l’équipe', () => {
  const monterAvecEquipe = async (equipes: Array<{ id: string; name: string; color?: string }>) => {
    const wrapper = await mountSuspended(SlotDetailsModal, {
      props: {
        modelValue: true,
        readOnly: true,
        teams: equipes,
        timeSlot: {
          id: 'creneau-1',
          title: 'Accueil du matin',
          startDateTime: '2026-10-02T12:00:00.000Z',
          endDateTime: '2026-10-02T14:00:00.000Z',
          teamId: 'accueil',
          maxVolunteers: 3,
          assignedVolunteers: 0,
          delayMinutes: null,
          assignedVolunteersList: [],
        },
      },
    })
    monte = wrapper
    return [...document.body.querySelectorAll('[style*="background-color"]')].map(
      (n) => (n as HTMLElement).getAttribute('style') ?? ''
    )
  }

  it('pose une pastille de la couleur de l’équipe devant son nom', async () => {
    const styles = await monterAvecEquipe(EQUIPES)

    expect(styles.some((s) => s.includes('rgb(59, 130, 246)') || s.includes('#3b82f6'))).toBe(true)
  })

  it('retombe sur un gris neutre quand l’équipe n’a pas de couleur', async () => {
    // Sans ce repli, la pastille emprunterait la couleur de l'équipe précédente.
    const styles = await monterAvecEquipe([{ id: 'accueil', name: 'Accueil' }])

    expect(styles.some((s) => s.includes('rgb(156, 163, 175)') || s.includes('#9ca3af'))).toBe(true)
  })
})

/**
 * Le même `formatDateTime` était recopié dans trois modales du planning, et les trois
 * retombaient sur le fuseau du navigateur. Deux restaient après la correction de la première.
 */
describe('DelayModal et AssignmentsModal — fuseau de l’édition', () => {
  const CRENEAU = {
    id: 'creneau-1',
    title: 'Accueil du matin',
    startDateTime: '2026-10-02T12:00:00.000Z',
    endDateTime: '2026-10-02T14:00:00.000Z',
    teamId: 'accueil',
    maxVolunteers: 3,
    assignedVolunteers: 0,
    delayMinutes: null,
  }

  const monterModale = async (composant: unknown, fuseau: string) => {
    const wrapper = await mountSuspended(composant as never, {
      props: { modelValue: true, editionId: 22, timeSlot: CRENEAU, fuseau },
    })
    monte = wrapper
    return document.body.textContent ?? ''
  }

  it('DelayModal annonce l’heure du lieu', async () => {
    const DelayModal = (
      await import('../../../../../../layers/volunteers/app/components/edition/volunteer/planning/DelayModal.vue')
    ).default

    expect(premiereHeure24(await monterModale(DelayModal, 'Europe/Paris'))).toBe(14 * 60)
    monte?.unmount()
    monte = null
    expect(premiereHeure24(await monterModale(DelayModal, 'Asia/Tokyo'))).toBe(21 * 60)
  })

  it('AssignmentsModal annonce l’heure du lieu', async () => {
    const AssignmentsModal = (
      await import('../../../../../../layers/volunteers/app/components/edition/volunteer/planning/AssignmentsModal.vue')
    ).default

    expect(premiereHeure24(await monterModale(AssignmentsModal, 'Europe/Paris'))).toBe(14 * 60)
    monte?.unmount()
    monte = null
    expect(premiereHeure24(await monterModale(AssignmentsModal, 'Asia/Tokyo'))).toBe(21 * 60)
  })
})
