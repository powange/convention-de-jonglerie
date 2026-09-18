import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { describe, it, expect, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { useVolunteerSchedule } from '../../../../../layers/volunteers/app/composables/useVolunteerSchedule'

// Le composable traduit les libellés du calendrier : un `t` passe-plat suffit ici.
mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => key,
  locale: { value: 'fr' },
}))

mockNuxtImport('useAvatar', () => () => ({ getUserAvatar: () => null }))

/**
 * La frise du planning se recalait sur son premier jour dès qu'un créneau était ajouté ou
 * supprimé : on remplissait un planning en refaisant défiler la timeline après chaque geste.
 *
 * La cause tenait à un watcher qui surveillait `timeSlots` en plus des dates et réécrivait
 * `initialDate` — l'option qui commande la position de FullCalendar. Ces tests fixent la règle :
 * seule une période différente déplace la vue.
 */
const creneau = (id: string, startDateTime: string, endDateTime: string) => ({
  id,
  title: `Créneau ${id}`,
  startDateTime,
  endDateTime,
  maxVolunteers: 2,
  assignedVolunteers: 0,
})

const monter = (
  timeSlots: ReturnType<typeof ref<any[]>>,
  dates = ['2026-09-25', '2026-09-27'],
  fuseau: string | null = null
) =>
  useVolunteerSchedule({
    teams: ref([]),
    timeSlots,
    editionStartDate: ref(dates[0]),
    editionEndDate: ref(dates[1]),
    fuseau,
    onTimeSlotCreate: vi.fn(),
    onTimeSlotUpdate: vi.fn(),
    onTimeSlotClick: vi.fn(),
    onTimeSlotDelete: vi.fn(),
  } as any)

describe('useVolunteerSchedule — position de la frise', () => {
  it('ne déplace pas la vue quand un créneau est ajouté', async () => {
    const timeSlots = ref([creneau('1', '2026-09-25T10:00:00Z', '2026-09-25T12:00:00Z')])
    const { calendarOptions } = monter(timeSlots)

    // L'organisateur a fait défiler la frise : FullCalendar suit `initialDate`
    calendarOptions.initialDate = '2026-09-27'

    timeSlots.value = [
      ...timeSlots.value,
      creneau('2', '2026-09-26T14:00:00Z', '2026-09-26T16:00:00Z'),
    ]
    await nextTick()

    expect(calendarOptions.initialDate).toBe('2026-09-27')
  })

  it('ne déplace pas la vue quand un créneau est supprimé', async () => {
    const timeSlots = ref([
      creneau('1', '2026-09-25T10:00:00Z', '2026-09-25T12:00:00Z'),
      creneau('2', '2026-09-26T14:00:00Z', '2026-09-26T16:00:00Z'),
    ])
    const { calendarOptions } = monter(timeSlots)
    calendarOptions.initialDate = '2026-09-27'

    timeSlots.value = [timeSlots.value[0]!]
    await nextTick()

    expect(calendarOptions.initialDate).toBe('2026-09-27')
  })

  it("recale la vue quand les dates de l'édition changent vraiment", async () => {
    const timeSlots = ref([creneau('1', '2026-09-25T10:00:00Z', '2026-09-25T12:00:00Z')])
    const debut = ref('2026-09-25')
    const { calendarOptions } = useVolunteerSchedule({
      teams: ref([]),
      timeSlots,
      editionStartDate: debut,
      editionEndDate: ref('2026-09-27'),
      onTimeSlotCreate: vi.fn(),
      onTimeSlotUpdate: vi.fn(),
      onTimeSlotClick: vi.fn(),
      onTimeSlotDelete: vi.fn(),
    } as any)

    // Une édition déplacée doit, elle, emmener la frise avec elle
    debut.value = '2026-10-02'
    await nextTick()

    expect(calendarOptions.initialDate).toBe('2026-10-02')
  })
})

/**
 * La frise s'ouvre sur le premier créneau plutôt que sur un premier jour de montage souvent vide.
 * La position est posée une fois, au premier chargement qui rapporte des créneaux : la reposer à
 * chaque ajout ramènerait le défaut que les tests ci-dessus verrouillent.
 */
describe('useVolunteerSchedule — position de départ sur le premier créneau', () => {
  it('se pose sur le premier créneau dès le premier chargement', async () => {
    const timeSlots = ref([creneau('1', '2026-09-26T10:00:00', '2026-09-26T12:00:00')])
    const { calendarOptions } = monter(timeSlots)
    await nextTick()

    expect(calendarOptions.scrollTime).toBe('34:00:00')
  })

  it('ne pose rien tant qu’aucun créneau n’existe', async () => {
    const { calendarOptions } = monter(ref([]))
    await nextTick()

    expect(calendarOptions.scrollTime).toBeUndefined()
  })

  it('ne repose pas la frise quand un créneau est ajouté ensuite', async () => {
    const timeSlots = ref([creneau('1', '2026-09-26T10:00:00', '2026-09-26T12:00:00')])
    const { calendarOptions } = monter(timeSlots)
    await nextTick()

    // L'organisateur a fait défiler, puis ajoute un créneau plus tôt dans la période
    calendarOptions.scrollTime = '48:00:00'
    timeSlots.value = [
      ...timeSlots.value,
      creneau('2', '2026-09-25T08:00:00', '2026-09-25T09:00:00'),
    ]
    await nextTick()

    expect(calendarOptions.scrollTime).toBe('48:00:00')
  })

  it('se pose au premier chargement, même si les créneaux arrivent après le montage', async () => {
    // Le cas réel : la page monte, puis l'appel réseau rapporte les créneaux.
    const timeSlots = ref<any[]>([])
    const { calendarOptions } = monter(timeSlots)
    await nextTick()

    timeSlots.value = [creneau('1', '2026-09-27T09:30:00', '2026-09-27T11:00:00')]
    await nextTick()

    expect(calendarOptions.scrollTime).toBe('57:30:00')
  })
})

/**
 * Les repères de la colonne des équipes.
 *
 * Une équipe volante ou autonome ne pèse pas dans les heures à pourvoir : sans repère, on lit sa
 * ligne comme celle des autres. L'icône vit dans le DOM natif de FullCalendar, hors de portée des
 * composants Nuxt UI — d'où l'infobulle par attribut `title`.
 */
describe('useVolunteerSchedule — repères des équipes', () => {
  const avecEquipes = (teams: any[]) =>
    useVolunteerSchedule({
      teams: ref(teams),
      timeSlots: ref([]),
      editionStartDate: ref('2026-09-25'),
      editionEndDate: ref('2026-09-27'),
      onTimeSlotCreate: vi.fn(),
      onTimeSlotUpdate: vi.fn(),
      onTimeSlotClick: vi.fn(),
      onTimeSlotDelete: vi.fn(),
    } as any)

  /** Le nœud que FullCalendar afficherait pour cette ressource. */
  const libelleDe = (calendarOptions: any, ressource: any): HTMLElement =>
    calendarOptions.resourceLabelContent({ resource: ressource }).domNodes[0]

  it('transmet les réglages de l’équipe à la ressource', async () => {
    const { calendarOptions } = avecEquipes([
      { id: 'e1', name: 'Volants', color: '#000', isFloatingTeam: true },
    ])
    await nextTick()

    const ressource = (calendarOptions.resources as any[]).find((r) => r.id === 'e1')
    expect(ressource?.extendedProps).toMatchObject({ isFloatingTeam: true })
  })

  it('pose une pastille sur une équipe volante, avec son libellé au survol', () => {
    const { calendarOptions } = avecEquipes([])
    const noeud = libelleDe(calendarOptions, {
      title: 'Volants',
      extendedProps: { isFloatingTeam: true },
    })

    const pastille = noeud.querySelector('[title]')
    expect(noeud.textContent).toContain('Volants')
    // Le libellé est accessible au survol ET aux lecteurs d'écran : une infobulle ne dit rien à
    // qui n'a pas de souris.
    expect(pastille?.getAttribute('title')).toBe('volunteers.floating_team_badge')
    expect(pastille?.getAttribute('aria-label')).toBe('volunteers.floating_team_badge')
  })

  it('pose une pastille distincte sur une équipe autonome', () => {
    const { calendarOptions } = avecEquipes([])
    const noeud = libelleDe(calendarOptions, {
      title: 'Sérénité',
      extendedProps: { isAutonomousTeam: true },
    })

    expect(noeud.querySelector('[title]')?.getAttribute('title')).toBe(
      'volunteers.autonomous_team_badge'
    )
  })

  it('ne pose aucune pastille sur une équipe ordinaire', () => {
    const { calendarOptions } = avecEquipes([])
    const noeud = libelleDe(calendarOptions, { title: 'Cuisine', extendedProps: {} })

    expect(noeud.querySelector('[title]')).toBeNull()
    expect(noeud.textContent).toBe('Cuisine')
  })
})

/**
 * L'heure d'un créneau est une heure de LIEU.
 *
 * « Le créneau accueil est à 14 h » veut dire 14 h sur place, que le planning soit consulté
 * depuis Paris, Tokyo ou un train. Sans fuseau posé, FullCalendar affiche dans celui du
 * navigateur, et le même créneau change d'heure selon qui regarde — ce qui est précisément ce
 * qu'un planning ne doit jamais faire.
 *
 * Ces tests tiennent l'OPTION passée à FullCalendar, et non le rendu : c'est elle qui commande,
 * et elle seule se teste sans monter un calendrier.
 */
describe('useVolunteerSchedule — fuseau de l’édition', () => {
  it("affiche dans le fuseau de l'édition quand elle en déclare un", () => {
    const { calendarOptions } = monter(ref([]), ['2026-09-25', '2026-09-27'], 'Europe/Paris')

    expect(calendarOptions.timeZone).toBe('Europe/Paris')
  })

  it("retombe sur la machine quand l'édition n'a pas de fuseau", () => {
    // Le champ est facultatif et les éditions anciennes n'en ont pas : un planning aux heures du
    // navigateur reste plus utile qu'un planning vide.
    const { calendarOptions } = monter(ref([]), ['2026-09-25', '2026-09-27'], null)

    expect(calendarOptions.timeZone).toBe('local')
  })

  it('retombe sur la machine quand le fuseau enregistré est invalide', () => {
    // La valeur vient parfois d'un import. La donner telle quelle à FullCalendar afficherait des
    // heures fausses sans rien signaler.
    const { calendarOptions } = monter(ref([]), ['2026-09-25', '2026-09-27'], 'Europe/Pariss')

    expect(calendarOptions.timeZone).toBe('local')
  })

  it("suit le fuseau quand l'édition arrive après le montage", async () => {
    // Cas courant : la carte se construit avant que l'édition soit chargée. Sans réactivité, le
    // calendrier resterait figé sur l'heure du navigateur jusqu'au rechargement suivant.
    const fuseau = ref<string | null>(null)
    const { calendarOptions } = useVolunteerSchedule({
      teams: ref([]),
      timeSlots: ref([]),
      editionStartDate: ref('2026-09-25'),
      editionEndDate: ref('2026-09-27'),
      fuseau,
    } as any)

    expect(calendarOptions.timeZone).toBe('local')

    fuseau.value = 'Europe/Paris'
    await nextTick()

    expect(calendarOptions.timeZone).toBe('Europe/Paris')
  })
})
