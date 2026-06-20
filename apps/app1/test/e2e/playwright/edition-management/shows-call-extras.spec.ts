import { expect, test } from '@nuxt/test-utils/playwright'

import {
  apiPost,
  buildShowApplicationBody,
  createShowCall,
  deleteShowCall,
  enableArtistProfile,
  getEditionArtists,
  getMyShowApplication,
  getShowCallApplications,
  getShowCallTechnicalNeeds,
  importPerformerFromApplication,
  loadState,
  submitShowApplicationViaApi,
  updateEdition,
  updateMyShowApplication,
  updateShowCall,
  updateShowCallApplicationStatus,
} from '../helpers'

const SHOW_CALL_NAME = `E2E Extras appel ${Date.now()}`
// Email unique du performer additionnel — importé comme EditionArtist
const PERFORMER_EMAIL = `e2e-import-perf-${Date.now()}@example.com`

/**
 * Couvre les fonctionnalités annexes des appels à spectacles non testées
 * par shows-call.spec.ts :
 *  - GET shows-call/technical-needs    : besoins techniques agrégés (organisateur)
 *  - PUT shows-call/[id]/my-application : édition de sa candidature (PENDING)
 *  - POST applications/[id]/import-performer : import d'un performer accepté
 *
 * Un seul appel + une seule candidature pilotent ces trois scénarios.
 */
test.describe.serial('Appel à spectacles : besoins techniques, édition et import', () => {
  let editionId: string
  let showCallId: string
  let applicationId: string

  test.beforeAll(() => {
    editionId = loadState().editionId
  })

  test("préparer : activer artistes, créer l'appel et candidater", async ({ page }) => {
    await updateEdition(page, editionId, { artistsEnabled: true })

    const showCall = await createShowCall(page, editionId, {
      name: SHOW_CALL_NAME,
      description: 'Appel de test E2E pour technical-needs / édition / import',
    })
    expect(showCall.id).toBeTruthy()
    showCallId = String(showCall.id)

    const deadline = new Date()
    deadline.setDate(deadline.getDate() + 30)
    await updateShowCall(page, editionId, showCallId, {
      name: SHOW_CALL_NAME,
      visibility: 'PUBLIC',
      mode: 'INTERNAL',
      deadline: deadline.toISOString(),
      askTechnicalNeeds: true,
      requirePhone: false,
    })

    await enableArtistProfile(page)

    const application = await submitShowApplicationViaApi(
      page,
      editionId,
      showCallId,
      buildShowApplicationBody({
        showTitle: 'E2E Extras - Spectacle',
        technicalNeeds: 'Besoins initiaux : sono basique',
        // Performer additionnel avec email connu pour l'import ultérieur
        additionalPerformersCount: 1,
        additionalPerformers: [
          {
            lastName: 'ImportNom',
            firstName: 'ImportPrenom',
            email: PERFORMER_EMAIL,
            phone: '+33611112222',
          },
        ],
      })
    )
    expect(application.status).toBe('PENDING')
    applicationId = String(application.id)
  })

  // ──────────────────────────────────────────────
  // Édition de candidature (my-application PUT)
  // ──────────────────────────────────────────────

  test("l'artiste modifie sa candidature tant qu'elle est PENDING", async ({ page }) => {
    const updated = await updateMyShowApplication(
      page,
      editionId,
      showCallId,
      buildShowApplicationBody({
        showTitle: 'E2E Extras - Spectacle MODIFIÉ',
        technicalNeeds: 'Besoins modifiés : scène 5x5m + lumières',
        additionalPerformersCount: 1,
        additionalPerformers: [
          {
            lastName: 'ImportNom',
            firstName: 'ImportPrenom',
            email: PERFORMER_EMAIL,
            phone: '+33611112222',
          },
        ],
      })
    )
    expect(updated.id).toBeTruthy()
    expect(updated.showTitle).toBe('E2E Extras - Spectacle MODIFIÉ')
  })

  test('la modification est visible via GET my-application', async ({ page }) => {
    const data = await getMyShowApplication(page, editionId, showCallId)
    expect(data.application).toBeTruthy()
    expect(data.application.showTitle).toBe('E2E Extras - Spectacle MODIFIÉ')
    expect(data.application.technicalNeeds).toContain('scène 5x5m')
  })

  // ──────────────────────────────────────────────
  // Besoins techniques agrégés (technical-needs GET)
  // ──────────────────────────────────────────────

  test('GET technical-needs : vide tant que la candidature est PENDING', async ({ page }) => {
    // L'endpoint n'agrège que les candidatures ACCEPTÉES
    const data = await getShowCallTechnicalNeeds(page, editionId)
    expect(Array.isArray(data.groups)).toBe(true)
    const found = data.groups
      .flatMap((g: { applications: { showTitle: string }[] }) => g.applications)
      .find((a: { showTitle: string }) => a.showTitle === 'E2E Extras - Spectacle MODIFIÉ')
    expect(found).toBeFalsy()
  })

  test('accepter la candidature pour les étapes suivantes', async ({ page }) => {
    await updateShowCallApplicationStatus(page, editionId, showCallId, applicationId, {
      status: 'ACCEPTED',
    })
  })

  test('GET technical-needs : la candidature acceptée apparaît avec ses besoins', async ({
    page,
  }) => {
    const data = await getShowCallTechnicalNeeds(page, editionId)
    expect(data).toHaveProperty('editionName')
    expect(Array.isArray(data.groups)).toBe(true)

    const allApps = data.groups.flatMap(
      (g: { applications: { showTitle: string; technicalNeeds: string | null }[] }) =>
        g.applications
    )
    const entry = allApps.find(
      (a: { showTitle: string }) => a.showTitle === 'E2E Extras - Spectacle MODIFIÉ'
    )
    expect(entry).toBeTruthy()
    expect(entry.technicalNeeds).toContain('scène 5x5m')
  })

  // ──────────────────────────────────────────────
  // Import d'un performer accepté (import-performer POST)
  // ──────────────────────────────────────────────

  test('import-performer importe le performer comme EditionArtist', async ({ page }) => {
    const result = await importPerformerFromApplication(
      page,
      editionId,
      showCallId,
      applicationId,
      {
        performerIndex: 0,
      }
    )
    expect(result.artistCreated).toBe(true)
    expect(result.artist).toBeTruthy()
    expect(result.artist.user.email).toBe(PERFORMER_EMAIL)
  })

  test("l'artiste importé apparaît dans GET /artists", async ({ page }) => {
    const artists = await getEditionArtists(page, editionId)
    expect(Array.isArray(artists)).toBe(true)
    const imported = artists.find(
      (a: { user?: { email?: string } }) => a.user?.email === PERFORMER_EMAIL
    )
    expect(imported).toBeTruthy()
  })

  test('re-import du même performer renvoie 409 (déjà importé)', async ({ page }) => {
    // L'endpoint est idempotent : tout étant déjà en place, il refuse en 409
    const response = await apiPost(
      page,
      `http://localhost:3000/api/editions/${editionId}/shows-call/${showCallId}/applications/${applicationId}/import-performer`,
      { data: { performerIndex: 0 } }
    )
    expect(response.status()).toBe(409)
  })

  // ──────────────────────────────────────────────
  // Nettoyage
  // ──────────────────────────────────────────────

  test('sanity : la candidature est bien ACCEPTED', async ({ page }) => {
    const data = await getShowCallApplications(page, editionId, showCallId)
    const applications = data.applications || data.items || data
    const app = applications.find((a: { id: number }) => String(a.id) === applicationId)
    expect(app).toBeTruthy()
    expect(app.status).toBe('ACCEPTED')
  })

  test("nettoyer : supprimer l'appel à spectacles", async ({ page }) => {
    if (showCallId) {
      await deleteShowCall(page, editionId, showCallId)
    }
  })
})
