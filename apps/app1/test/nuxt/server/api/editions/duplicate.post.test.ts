import { describe, it, expect, vi, beforeEach } from 'vitest'

const getConventionForEditionCreation = vi.hoisted(() => vi.fn(async () => ({ id: 1 })))

vi.mock('../../../../../server/utils/permissions/convention-permissions', () => ({
  getConventionForEditionCreation,
}))

vi.mock('../../../../../server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event: any) => {
    if (!event?.context?.user) {
      throw createError({ status: 401, message: 'Unauthorized' })
    }
    return event.context.user
  }),
}))

vi.mock('../../../../../server/utils/cache-helpers', () => ({
  invalidateEditionCache: vi.fn(async () => undefined),
}))

import handler from '../../../../../server/api/editions/[id]/duplicate.post'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * Ce que la duplication d'une édition emporte, et ce qu'elle laisse volontairement derrière.
 *
 * ⚠️ POURQUOI CE FICHIER EXISTE : la duplication n'en avait AUCUN, alors qu'elle recopie une
 * édition champ par champ depuis un `select` explicite. Un champ ajouté au modèle et oublié dans
 * ce `select` ne produit aucune erreur — la copie naît simplement avec le défaut du schéma, et
 * personne ne s'en aperçoit avant d'ouvrir l'édition dupliquée et de chercher un réglage disparu.
 *
 * SEIZE CHAMPS MANQUAIENT. Le plus visible : `siteMapEnabled`. Les zones et les marqueurs sont
 * recopiés — il y a du code pour cela, quelques lignes plus bas — mais le module restait ÉTEINT :
 * la copie avait une carte complète, invisible, et pas même d'onglet pour la trouver. De même la
 * devise, qui conditionne TOUS les montants de la trésorerie et de la billetterie et repartait
 * en EUR.
 *
 * ⚠️⚠️ ET UN CHAMP A DÛ ÊTRE RETIRÉ, ce que le constat ne pouvait pas savoir : `mapPublic` était
 * copié. Depuis #644, les points d'API publics des zones et des marqueurs laissent passer un
 * anonyme dès que `siteMapEnabled && mapPublic`, sans regarder le statut de l'édition. Ajouter
 * `siteMapEnabled` en gardant `mapPublic` aurait donc livré la carte d'une copie fraîche, non
 * publiée, à qui connaît son numéro. C'est le test 🔬 le plus important de ce fichier.
 */

const UTILISATEUR = { id: 9, pseudo: 'Alex' }
const evenement = { context: { user: UTILISATEUR, params: { id: '1' } } }

/** L'édition source, avec les champs qui nous intéressent. Le mock ignore le `select`. */
const source = {
  conventionId: 1,
  name: 'Convention des Balles 2026',
  description: 'Une description',
  startDate: new Date('2026-06-01'),
  endDate: new Date('2026-06-03'),
  timezone: 'Europe/Paris',
  currency: 'CHF',
  artistInfo: 'Contacter la régie',
  addressLine1: '1 rue du Jonglage',
  addressLine2: 'Bâtiment B',
  city: 'Lyon',
  region: 'Rhône',
  country: 'France',
  postalCode: '69000',
  latitude: 45.75,
  longitude: 4.85,
  facebookUrl: 'https://facebook.test/x',
  instagramUrl: null,
  ticketingUrl: null,
  officialWebsiteUrl: 'https://exemple.test',
  jugglingEdgeUrl: 'https://jugglingedge.test/1',
  programUrl: 'https://exemple.test/programme',
  hasUnicycleSpace: true,
  hasFoodTrucks: true,
  siteMapEnabled: true,
  programEnabled: true,
  tasksEnabled: true,
  stockEnabled: true,
  faqEnabled: true,
  treasuryEnabled: true,
  mealsEnabled: true,
  artistsEnabled: true,
  ticketingEnabled: true,
  workshopsEnabled: true,
  workshopLocationsFreeInput: true,
  ticketingPaymentCash: false,
  ticketingPaymentCard: false,
  ticketingPaymentCheck: true,
  ticketingSumupEnabled: true,
  ticketingHandoutItemsEnabled: false,
  ticketingAllowOnsiteRegistration: true,
  ticketingAllowAnonymousOrders: true,
  externalMapProvider: 'GOOGLE_MY_MAPS',
  externalMapRef: 'ref-123',
  event: { volunteerSettings: null },
}

/** Les données passées à `edition.create` dans la transaction. */
const copie = () => prismaMock.edition.create.mock.calls.at(-1)![0].data

/** Le `select` avec lequel l'édition source a été lue. */
const selectDeLaSource = () => prismaMock.edition.findUnique.mock.calls[0][0].select

describe('POST /api/editions/[id]/duplicate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn().mockReturnValue('1')
    getConventionForEditionCreation.mockResolvedValue({ id: 1 } as never)
    prismaMock.edition.findUnique.mockResolvedValue(source)
    prismaMock.editionZone.findMany.mockResolvedValue([])
    prismaMock.editionMarker.findMany.mockResolvedValue([])
    prismaMock.event.create.mockResolvedValue({ id: 77 })
    prismaMock.edition.create.mockResolvedValue({ id: 77 })
    prismaMock.edition.findUniqueOrThrow.mockResolvedValue({ id: 77, name: 'copie' })
  })

  it('reprend la devise, les liens et les informations artistes', async () => {
    /*
     * La devise d'abord : elle commande l'affichage de tous les montants de la trésorerie et de la
     * billetterie. Une copie qui repart en EUR fait changer de sens aux tarifs recopiés.
     */
    await handler(evenement as any)

    expect(copie().currency).toBe('CHF')
    expect(copie().jugglingEdgeUrl).toBe('https://jugglingedge.test/1')
    expect(copie().programUrl).toBe('https://exemple.test/programme')
    expect(copie().artistInfo).toBe('Contacter la régie')
    expect(copie().hasUnicycleSpace).toBe(true)
  })

  it('reprend l’ACTIVATION des six modules oubliés', async () => {
    /*
     * 🔬 `siteMapEnabled` est le cas qui se voit : les zones et les marqueurs sont recopiés
     * quelques lignes plus bas, mais le module restait éteint — carte complète, aucun onglet pour
     * la trouver.
     */
    await handler(evenement as any)

    const c = copie()
    expect(c.siteMapEnabled).toBe(true)
    expect(c.programEnabled).toBe(true)
    expect(c.tasksEnabled).toBe(true)
    expect(c.stockEnabled).toBe(true)
    expect(c.faqEnabled).toBe(true)
    expect(c.treasuryEnabled).toBe(true)
  })

  it('reprend les cinq réglages de paiement de la billetterie', async () => {
    // Des réglages qu'on repose un par un si la copie ne les emporte pas — et qu'on oublie.
    await handler(evenement as any)

    const c = copie()
    expect(c.ticketingPaymentCash).toBe(false)
    expect(c.ticketingPaymentCard).toBe(false)
    expect(c.ticketingPaymentCheck).toBe(true)
    expect(c.ticketingSumupEnabled).toBe(true)
    expect(c.ticketingHandoutItemsEnabled).toBe(false)
  })

  it('🔬 NE COPIE PAS `mapPublic` — la copie ne publie rien', async () => {
    /*
     * ⚠️⚠️ L'ASSERTION LA PLUS IMPORTANTE DE CE FICHIER, et elle garde une BRÈCHE fermée.
     *
     * Depuis #644, `/api/editions/:id/zones` et `/markers` laissent passer un ANONYME dès que
     * `siteMapEnabled && mapPublic` — et ils ne regardent pas le statut de l'édition. Le test
     * précédent ajoute `siteMapEnabled` à la copie ; si `mapPublic` revenait avec lui, une copie
     * fraîche et `OFFLINE` livrerait sa carte à qui connaît son numéro.
     *
     * On mesure les DEUX bouts : que le champ ne soit pas demandé à la source, et qu'il n'arrive
     * pas dans la copie. Le demander sans l'écrire le ferait entrer par `...structuralFields`.
     */
    await handler(evenement as any)

    expect(selectDeLaSource()).not.toHaveProperty('mapPublic')
    expect(copie()).not.toHaveProperty('mapPublic')
  })

  it('ne copie AUCUN drapeau de publication', async () => {
    // Même raison : la copie naît non publiée, et rien de ce qu'elle contient n'est annoncé.
    await handler(evenement as any)

    const c = copie()
    expect(c).not.toHaveProperty('faqPagePublic')
    expect(c).not.toHaveProperty('programPagePublic')
  })

  it('naît OFFLINE, sans image, et au nom marqué « (copie) »', async () => {
    await handler(evenement as any)

    const c = copie()
    expect(c.status).toBe('OFFLINE')
    expect(c.imageUrl).toBeNull()
    expect(c.creatorId).toBe(UTILISATEUR.id)
    expect(c.name).toBe('Convention des Balles 2026 (copie)')
  })

  it('garde un nom absent absent, plutôt que d’inventer « (copie) »', async () => {
    // Une édition sans nom propre s'affiche sous celui de sa convention : « (copie) » seul ne
    // dirait rien.
    prismaMock.edition.findUnique.mockResolvedValue({ ...source, name: null })

    await handler(evenement as any)

    expect(copie().name).toBeNull()
  })

  it('emporte la carte externe avec les zones et les marqueurs', async () => {
    prismaMock.editionZone.findMany.mockResolvedValue([{ name: 'Chapiteau', order: 0 }])
    prismaMock.editionMarker.findMany.mockResolvedValue([{ name: 'Accueil', order: 0 }])

    await handler(evenement as any)

    expect(copie().externalMapProvider).toBe('GOOGLE_MY_MAPS')
    expect(copie().externalMapRef).toBe('ref-123')
    expect(prismaMock.editionZone.createMany).toHaveBeenCalled()
    expect(prismaMock.editionMarker.createMany).toHaveBeenCalled()
  })

  it('ROUVRE les candidatures fermées et efface les dates de montage', async () => {
    /*
     * La configuration bénévole suit, mais pas son état : une copie dont les candidatures seraient
     * ouvertes recevrait des bénévoles pour une édition qui n'existe pas encore vraiment.
     */
    prismaMock.edition.findUnique.mockResolvedValue({
      ...source,
      event: {
        volunteerSettings: {
          eventId: 1,
          open: true,
          updatedAt: new Date(),
          setupStartDate: new Date('2026-05-30'),
          teardownEndDate: new Date('2026-06-04'),
          askDiet: true,
        },
      },
    })
    prismaMock.eventVolunteerSettings.create.mockResolvedValue({})

    await handler(evenement as any)

    const reglages = prismaMock.eventVolunteerSettings.create.mock.calls.at(-1)![0].data
    expect(reglages.open).toBe(false)
    expect(reglages.setupStartDate).toBeNull()
    expect(reglages.teardownEndDate).toBeNull()
    // Ce qui n'est pas un état, en revanche, suit bien.
    expect(reglages.askDiet).toBe(true)
    expect(reglages.eventId).toBe(77)
  })

  it('exige le droit de CRÉER une édition dans la convention', async () => {
    // Dupliquer, c'est créer : c'est la même garde, et elle doit précéder toute écriture.
    getConventionForEditionCreation.mockRejectedValue(
      createError({ status: 403, message: 'Droit insuffisant pour créer une édition' }) as never
    )

    await expect(handler(evenement as any)).rejects.toMatchObject({ statusCode: 403 })
    expect(prismaMock.edition.create).not.toHaveBeenCalled()
  })

  it('rend 404 pour une édition source introuvable', async () => {
    prismaMock.edition.findUnique.mockResolvedValue(null)

    await expect(handler(evenement as any)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('refuse un anonyme', async () => {
    await expect(handler({ context: {} } as any)).rejects.toMatchObject({ statusCode: 401 })
  })
})
