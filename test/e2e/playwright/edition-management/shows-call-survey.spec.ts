import { expect, test } from '@nuxt/test-utils/playwright'

import {
  buildShowApplicationBody,
  createShowCall,
  createSurveyToken,
  deleteShowCall,
  enableArtistProfile,
  getShowCallApplications,
  getSurveyResults,
  loadState,
  setSurveyStatus,
  submitShowApplicationViaApi,
  updateEdition,
  updateShowCall,
} from '../helpers'

const SHOW_CALL_NAME = `E2E Sondage technique ${Date.now()}`

/**
 * Couvre le sondage technique (survey) d'un appel à spectacles :
 *  - POST survey/token  : création du sondage (token + URL + surveyOpen)
 *  - PATCH survey/status : fermeture puis réouverture du sondage
 *  - GET survey/results  : récupération des candidatures avec résultats de votes
 *
 * Les parcours de création/candidature/accept/refus sont déjà couverts par
 * shows-call.spec.ts ; ici on se concentre uniquement sur le sondage. Chaque
 * test crée son propre appel (showCallId isolé) afin que l'utilisateur E2E
 * puisse candidater (1 candidature par couple showCall/user).
 */
test.describe.serial('Appel à spectacles : sondage technique (survey)', () => {
  let editionId: string
  let showCallId: string
  let applicationId: string
  let surveyToken: string

  test.beforeAll(() => {
    editionId = loadState().editionId
  })

  test("préparer : activer les artistes, créer l'appel + une candidature", async ({ page }) => {
    await updateEdition(page, editionId, { artistsEnabled: true })

    const showCall = await createShowCall(page, editionId, {
      name: SHOW_CALL_NAME,
      description: 'Appel de test pour le sondage technique E2E',
    })
    expect(showCall.id).toBeTruthy()
    showCallId = String(showCall.id)

    // Configurer l'appel : PUBLIC, INTERNAL, deadline future, téléphone non requis
    const deadline = new Date()
    deadline.setDate(deadline.getDate() + 30)
    await updateShowCall(page, editionId, showCallId, {
      name: SHOW_CALL_NAME,
      visibility: 'PUBLIC',
      mode: 'INTERNAL',
      deadline: deadline.toISOString(),
      requirePhone: false,
    })

    // L'utilisateur E2E doit être artiste pour candidater
    await enableArtistProfile(page)

    const application = await submitShowApplicationViaApi(
      page,
      editionId,
      showCallId,
      buildShowApplicationBody({ showTitle: 'E2E Sondage - Spectacle' })
    )
    expect(application.id).toBeTruthy()
    expect(application.status).toBe('PENDING')
    applicationId = String(application.id)
  })

  test('POST survey/token crée le sondage (token, surveyUrl, surveyOpen)', async ({ page }) => {
    const result = await createSurveyToken(page, editionId, showCallId)

    expect(result.surveyToken).toBeTruthy()
    expect(typeof result.surveyToken).toBe('string')
    surveyToken = result.surveyToken

    expect(result.surveyUrl).toBeTruthy()
    expect(result.surveyUrl).toContain(`/survey/${surveyToken}`)
  })

  test('le sondage est ouvert après création (via GET results)', async ({ page }) => {
    const results = await getSurveyResults(page, editionId, showCallId)
    expect(results.surveyOpen).toBe(true)
    expect(results.surveyToken).toBe(surveyToken)
    expect(results.surveyUrl).toContain(`/survey/${surveyToken}`)
  })

  test('PATCH survey/status ferme le sondage', async ({ page }) => {
    const result = await setSurveyStatus(page, editionId, showCallId, false)
    expect(result.surveyOpen).toBe(false)

    // Confirmer via GET results
    const results = await getSurveyResults(page, editionId, showCallId)
    expect(results.surveyOpen).toBe(false)
  })

  test('PATCH survey/status rouvre le sondage', async ({ page }) => {
    const result = await setSurveyStatus(page, editionId, showCallId, true)
    expect(result.surveyOpen).toBe(true)

    const results = await getSurveyResults(page, editionId, showCallId)
    expect(results.surveyOpen).toBe(true)
  })

  test('GET survey/results renvoie la candidature avec une structure de votes', async ({
    page,
  }) => {
    const results = await getSurveyResults(page, editionId, showCallId)

    expect(Array.isArray(results.results)).toBe(true)
    expect(results.results.length).toBeGreaterThanOrEqual(1)

    const entry = results.results.find(
      (r: { applicationId: number }) => String(r.applicationId) === applicationId
    )
    expect(entry).toBeTruthy()
    // Structure attendue d'une ligne de résultat
    expect(entry).toHaveProperty('artistName')
    expect(entry).toHaveProperty('showTitle')
    expect(entry).toHaveProperty('status')
    // Aucun vote réel n'a été simulé : avgScore null, voteCount 0
    expect(entry.avgScore).toBeNull()
    expect(entry.voteCount).toBe(0)
  })

  test('la candidature est bien rattachée à cet appel (sanity check)', async ({ page }) => {
    const data = await getShowCallApplications(page, editionId, showCallId)
    const applications = data.applications || data.items || data
    expect(Array.isArray(applications)).toBe(true)
    expect(applications.some((a: { id: number }) => String(a.id) === applicationId)).toBe(true)
  })

  test("nettoyer : supprimer l'appel à spectacles", async ({ page }) => {
    if (showCallId) {
      await deleteShowCall(page, editionId, showCallId)
    }
  })
})
