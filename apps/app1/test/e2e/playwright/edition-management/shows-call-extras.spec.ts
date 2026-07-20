import { expect, test } from '@nuxt/test-utils/playwright'

import {
  apiPost,
  buildShowApplicationBody,
  createShow,
  createShowCall,
  deleteShow,
  deleteShowCall,
  enableArtistProfile,
  getEditionArtists,
  getMyShowApplication,
  getShow,
  getShowCallApplications,
  getShowCallTechnicalNeeds,
  importPerformerFromApplication,
  linkApplicationToShow,
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

// ════════════════════════════════════════════════════════════════
// Import sur un spectacle CABARET : la candidature devient un numéro
// ════════════════════════════════════════════════════════════════

const CABARET_SHOW_CALL_NAME = `E2E Cabaret appel ${Date.now()}`
// showTitle de la candidature = titre du numéro créé, et clé de rapprochement
const CABARET_NUMERO_TITLE = `E2E Numéro cabaret ${Date.now()}`
// Deux performers d'une même candidature : ils doivent atterrir dans LE MÊME numéro
const CABARET_PERF_1_EMAIL = `e2e-cab-perf1-${Date.now()}@example.com`
const CABARET_PERF_2_EMAIL = `e2e-cab-perf2-${Date.now()}@example.com`
// Mise en place scène : reprise dans le nouveau champ stageSetup du numéro
const CABARET_STAGE_SETUP = 'Praticable 4x4 + tapis de chute, à retirer après le numéro'

test.describe.serial('Import performer sur un cabaret : création de numéro', () => {
  let editionId: string
  let showCallId: string
  let applicationId: string
  let cabaretShowId: number

  test.beforeAll(() => {
    editionId = loadState().editionId
  })

  test('préparer : appel + candidature à 2 performers, acceptée', async ({ page }) => {
    await updateEdition(page, editionId, { artistsEnabled: true })

    const showCall = await createShowCall(page, editionId, {
      name: CABARET_SHOW_CALL_NAME,
      description: 'Appel E2E pour import cabaret',
    })
    expect(showCall.id).toBeTruthy()
    showCallId = String(showCall.id)

    const deadline = new Date()
    deadline.setDate(deadline.getDate() + 30)
    await updateShowCall(page, editionId, showCallId, {
      name: CABARET_SHOW_CALL_NAME,
      visibility: 'PUBLIC',
      mode: 'INTERNAL',
      deadline: deadline.toISOString(),
      requirePhone: false,
    })

    await enableArtistProfile(page)

    const application = await submitShowApplicationViaApi(
      page,
      editionId,
      showCallId,
      buildShowApplicationBody({
        showTitle: CABARET_NUMERO_TITLE,
        showDuration: 12,
        stageSetup: CABARET_STAGE_SETUP,
        additionalPerformersCount: 2,
        additionalPerformers: [
          {
            lastName: 'CabNom1',
            firstName: 'CabPrenom1',
            email: CABARET_PERF_1_EMAIL,
            phone: '+33611110001',
          },
          {
            lastName: 'CabNom2',
            firstName: 'CabPrenom2',
            email: CABARET_PERF_2_EMAIL,
            phone: '+33611110002',
          },
        ],
      })
    )
    expect(application.id).toBeTruthy()
    applicationId = String(application.id)

    await updateShowCallApplicationStatus(page, editionId, showCallId, applicationId, {
      status: 'ACCEPTED',
    })
  })

  test('créer un spectacle CABARET et y lier la candidature', async ({ page }) => {
    const show = await createShow(page, editionId, {
      title: `E2E Cabaret ${Date.now()}`,
      type: 'CABARET',
      startDateTime: new Date().toISOString(),
      acts: [],
    })
    expect(show.id).toBeTruthy()
    expect(show.type).toBe('CABARET')
    cabaretShowId = show.id

    const linked = await linkApplicationToShow(
      page,
      editionId,
      showCallId,
      applicationId,
      cabaretShowId
    )
    expect(linked.showId).toBe(cabaretShowId)
  })

  test('importer le 1er performer crée le numéro', async ({ page }) => {
    const result = await importPerformerFromApplication(
      page,
      editionId,
      showCallId,
      applicationId,
      { performerIndex: 0 }
    )
    expect(result.artistCreated).toBe(true)
    expect(result.actCreated).toBe(true)
    expect(result.showLinkCreated).toBe(true)
  })

  test('importer le 2e performer réutilise le même numéro (pas de doublon)', async ({ page }) => {
    const result = await importPerformerFromApplication(
      page,
      editionId,
      showCallId,
      applicationId,
      { performerIndex: 1 }
    )
    expect(result.artistCreated).toBe(true)
    // Le numéro existe déjà (créé au 1er import) → pas de nouvelle création
    expect(result.actCreated).toBe(false)
    expect(result.showLinkCreated).toBe(true)
  })

  test('le cabaret contient un unique numéro avec les 2 performers', async ({ page }) => {
    const show = await getShow(page, editionId, cabaretShowId)
    expect(show.type).toBe('CABARET')

    const matching = (show.acts || []).filter(
      (a: { title: string }) => a.title === CABARET_NUMERO_TITLE
    )
    expect(matching).toHaveLength(1)

    // La mise en place scène de la candidature est reprise dans le numéro
    expect(matching[0].stageSetup).toBe(CABARET_STAGE_SETUP)

    const emails = (matching[0].artists || []).map(
      (sa: { artist: { user: { email: string } } }) => sa.artist.user.email
    )
    expect(emails).toContain(CABARET_PERF_1_EMAIL)
    expect(emails).toContain(CABARET_PERF_2_EMAIL)
  })

  test('nettoyer : supprimer le spectacle et l’appel', async ({ page }) => {
    if (cabaretShowId) await deleteShow(page, editionId, cabaretShowId)
    if (showCallId) await deleteShowCall(page, editionId, showCallId)
  })
})

// ════════════════════════════════════════════════════════════════
// Import sur un spectacle STANDARD : concaténation des besoins techniques
// ════════════════════════════════════════════════════════════════

const STD_SHOW_CALL_NAME = `E2E Standard appel ${Date.now()}`
// Besoins techniques déjà saisis sur le spectacle : ne doivent PAS être écrasés
const STD_INITIAL_TECH = `Besoins existants spectacle ${Date.now()}`
// Besoins techniques de la candidature : doivent être AJOUTÉS à la suite
const STD_APP_TECH = `Besoins candidature ${Date.now()}`
const STD_PERF_1_EMAIL = `e2e-std-perf1-${Date.now()}@example.com`
const STD_PERF_2_EMAIL = `e2e-std-perf2-${Date.now()}@example.com`

test.describe.serial('Import performer sur un standard : concaténation besoins techniques', () => {
  let editionId: string
  let showCallId: string
  let applicationId: string
  let standardShowId: number

  test.beforeAll(() => {
    editionId = loadState().editionId
  })

  test('préparer : appel + candidature à 2 performers, acceptée', async ({ page }) => {
    await updateEdition(page, editionId, { artistsEnabled: true })

    const showCall = await createShowCall(page, editionId, {
      name: STD_SHOW_CALL_NAME,
      description: 'Appel E2E pour concaténation besoins techniques',
    })
    expect(showCall.id).toBeTruthy()
    showCallId = String(showCall.id)

    const deadline = new Date()
    deadline.setDate(deadline.getDate() + 30)
    await updateShowCall(page, editionId, showCallId, {
      name: STD_SHOW_CALL_NAME,
      visibility: 'PUBLIC',
      mode: 'INTERNAL',
      deadline: deadline.toISOString(),
      requirePhone: false,
    })

    await enableArtistProfile(page)

    const application = await submitShowApplicationViaApi(
      page,
      editionId,
      showCallId,
      buildShowApplicationBody({
        showTitle: `E2E Standard spectacle ${Date.now()}`,
        technicalNeeds: STD_APP_TECH,
        additionalPerformersCount: 2,
        additionalPerformers: [
          {
            lastName: 'StdNom1',
            firstName: 'StdPrenom1',
            email: STD_PERF_1_EMAIL,
            phone: '+33611120001',
          },
          {
            lastName: 'StdNom2',
            firstName: 'StdPrenom2',
            email: STD_PERF_2_EMAIL,
            phone: '+33611120002',
          },
        ],
      })
    )
    expect(application.id).toBeTruthy()
    applicationId = String(application.id)

    await updateShowCallApplicationStatus(page, editionId, showCallId, applicationId, {
      status: 'ACCEPTED',
    })
  })

  test('créer un spectacle STANDARD (avec besoins existants) et y lier la candidature', async ({
    page,
  }) => {
    const show = await createShow(page, editionId, {
      title: `E2E Standard ${Date.now()}`,
      type: 'STANDARD',
      startDateTime: new Date().toISOString(),
      technicalNeeds: STD_INITIAL_TECH,
    })
    expect(show.id).toBeTruthy()
    standardShowId = show.id

    await linkApplicationToShow(page, editionId, showCallId, applicationId, standardShowId)
  })

  test('importer le 1er performer ajoute les besoins de la candidature', async ({ page }) => {
    const result = await importPerformerFromApplication(
      page,
      editionId,
      showCallId,
      applicationId,
      { performerIndex: 0 }
    )
    expect(result.artistCreated).toBe(true)
    expect(result.showLinkCreated).toBe(true)
    expect(result.showTechNeedsAppended).toBe(true)

    const show = await getShow(page, editionId, standardShowId)
    // L'existant est conservé ET les besoins de la candidature sont ajoutés
    expect(show.technicalNeeds).toContain(STD_INITIAL_TECH)
    expect(show.technicalNeeds).toContain(STD_APP_TECH)
  })

  test('importer le 2e performer ne duplique pas les besoins (idempotent)', async ({ page }) => {
    const result = await importPerformerFromApplication(
      page,
      editionId,
      showCallId,
      applicationId,
      { performerIndex: 1 }
    )
    expect(result.artistCreated).toBe(true)
    // Les besoins de la candidature sont déjà présents → pas de nouvel ajout
    expect(result.showTechNeedsAppended).toBe(false)

    const show = await getShow(page, editionId, standardShowId)
    const occurrences = (show.technicalNeeds as string).split(STD_APP_TECH).length - 1
    expect(occurrences).toBe(1)
  })

  test('nettoyer : supprimer le spectacle et l’appel', async ({ page }) => {
    if (standardShowId) await deleteShow(page, editionId, standardShowId)
    if (showCallId) await deleteShowCall(page, editionId, showCallId)
  })
})
