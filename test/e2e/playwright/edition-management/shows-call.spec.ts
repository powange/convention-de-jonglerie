import { expect, test } from '@nuxt/test-utils/playwright'

import {
  createShowCall,
  deleteShowCall,
  enableArtistProfile,
  getShowCallApplications,
  loadState,
  saveToState,
  loadFromState,
  setEditionStatus,
  updateShowCall,
  updateShowCallApplicationStatus,
} from '../helpers'

const SHOW_CALL_NAME = 'E2E Appel à spectacles'
const SHOW_CALL_DESCRIPTION = 'Description de test pour appel à spectacles E2E'

test.describe
  .serial('Parcours complet appels à spectacles : création → candidature → gestion', () => {
  // ──────────────────────────────────────────────
  // Phase 1 : Création et configuration de l'appel à spectacles
  // ──────────────────────────────────────────────

  test("créer un appel à spectacles via l'API", async ({ page }) => {
    const { editionId } = loadState()

    const showCall = await createShowCall(page, editionId, {
      name: SHOW_CALL_NAME,
      description: SHOW_CALL_DESCRIPTION,
    })

    expect(showCall.id).toBeTruthy()
    saveToState('showCallId', String(showCall.id))
  })

  test("configurer l'appel : visibilité PUBLIC, deadline future", async ({ page }) => {
    const { editionId } = loadState()
    const showCallId = loadFromState('showCallId')
    expect(showCallId).toBeTruthy()

    const deadline = new Date()
    deadline.setDate(deadline.getDate() + 30)

    await updateShowCall(page, editionId, showCallId!, {
      name: SHOW_CALL_NAME,
      visibility: 'PUBLIC',
      mode: 'INTERNAL',
      deadline: deadline.toISOString(),
      description: SHOW_CALL_DESCRIPTION,
      askPortfolioUrl: true,
      askVideoUrl: true,
      askTechnicalNeeds: true,
      askAccommodation: false,
      askDepartureCity: false,
      askSocialLinks: false,
    })
  })

  test("publier l'édition", async ({ page }) => {
    const { editionId } = loadState()
    await setEditionStatus(page, editionId, 'PUBLISHED')
  })

  // ──────────────────────────────────────────────
  // Phase 2 : Page de gestion organisateur
  // ──────────────────────────────────────────────

  test("la page de gestion affiche l'appel créé", async ({ page, goto }) => {
    const { editionId } = loadState()

    await expect(async () => {
      await goto(`/editions/${editionId}/gestion/shows-call`, { waitUntil: 'hydration' })
      await page.waitForSelector('main', { timeout: 10000 })
      await expect(page.getByText(SHOW_CALL_NAME).first()).toBeVisible({ timeout: 3000 })
    }).toPass({ timeout: 30000, intervals: [3000] })
  })

  test("la page de configuration de l'appel est accessible", async ({ page, goto }) => {
    const { editionId } = loadState()
    const showCallId = loadFromState('showCallId')

    await goto(`/editions/${editionId}/gestion/shows-call/${showCallId}`, {
      waitUntil: 'hydration',
    })
    await page.waitForSelector('main', { timeout: 15000 })

    // Vérifier que le nom de l'appel est affiché dans le champ de saisie
    await expect(page.locator(`input[value="${SHOW_CALL_NAME}"]`).first()).toBeVisible({
      timeout: 10000,
    })
  })

  // ──────────────────────────────────────────────
  // Phase 3 : Candidature artiste
  // ──────────────────────────────────────────────

  test("activer le profil artiste pour l'utilisateur E2E", async ({ page }) => {
    await enableArtistProfile(page)
  })

  test("la page publique de l'appel est accessible", async ({ page, goto }) => {
    const { editionId } = loadState()
    const showCallId = loadFromState('showCallId')

    await expect(async () => {
      await goto(`/editions/${editionId}/shows-call/${showCallId}`, { waitUntil: 'hydration' })
      await page.waitForSelector('main', { timeout: 10000 })
      await expect(page.getByText(SHOW_CALL_NAME).first()).toBeVisible({ timeout: 3000 })
    }).toPass({ timeout: 30000, intervals: [3000] })
  })

  test('la page de candidature affiche le formulaire', async ({ page, goto }) => {
    const { editionId } = loadState()
    const showCallId = loadFromState('showCallId')

    await goto(`/editions/${editionId}/shows-call/${showCallId}/apply`, {
      waitUntil: 'hydration',
    })
    await page.waitForSelector('main', { timeout: 15000 })

    // Vérifier que le formulaire est visible (titre de l'appel + champs obligatoires)
    await expect(page.getByText(SHOW_CALL_NAME).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/formulaire de candidature/i).first()).toBeVisible({
      timeout: 5000,
    })
  })

  test('remplir et soumettre la candidature via le formulaire UI', async ({ page, goto }) => {
    const { editionId } = loadState()
    const showCallId = loadFromState('showCallId')

    await goto(`/editions/${editionId}/shows-call/${showCallId}/apply`, {
      waitUntil: 'hydration',
    })
    await page.waitForSelector('main', { timeout: 15000 })

    // Attendre que le formulaire soit chargé
    await expect(page.getByText(/formulaire de candidature/i).first()).toBeVisible({
      timeout: 10000,
    })

    // Section : Informations personnelles (candidat principal)
    // On cible par attribut name pour éviter les conflits avec additionalPerformers.*
    const lastNameField = page.locator('input[name="lastName"]')
    await expect(lastNameField).toBeVisible({ timeout: 5000 })
    await lastNameField.fill('E2E-Nom-Artiste')

    await page.locator('input[name="firstName"]').fill('E2E-Prénom-Artiste')
    await page.locator('input[name="phone"]').fill('+33698765432')

    // Section : Informations artiste
    await page.getByLabel(/nom de scène/i).fill('E2E Artiste Jongleur')
    await page.getByLabel(/biographie/i).fill('Artiste de test pour les tests E2E automatisés')
    await page.getByLabel(/portfolio/i).fill('https://example.com/portfolio')
    await page.getByLabel(/vidéo/i).fill('https://example.com/video')

    // Section : Informations spectacle
    await page.getByLabel(/titre du spectacle/i).fill('E2E Spectacle de Jonglage')
    await page
      .getByLabel(/description/i)
      .last()
      .fill(
        'Un spectacle de jonglage exceptionnel créé pour les tests E2E automatisés de la plateforme.'
      )
    await page.getByLabel(/durée/i).fill('45')
    await page.getByLabel(/catégorie/i).fill('jonglage')
    await page.getByLabel(/besoins techniques/i).fill('Scène 4x4m, sono, éclairage')

    // Section : Nombre d'artistes — sélectionner 1
    // Scoper au main pour éviter le bouton "1" du compteur de notifications dans le header
    await page.getByRole('main').getByRole('button', { name: '1', exact: true }).click()

    // Remplir manuellement les champs du premier artiste additionnel
    // (ne pas utiliser "Je participe" car l'utilisateur E2E n'a pas nom/prenom dans le profil)
    await page.locator('input[name="additionalPerformers.0.lastName"]').fill('E2E-Artist-Last')
    await page.locator('input[name="additionalPerformers.0.firstName"]').fill('E2E-Artist-First')
    await page.locator('input[name="additionalPerformers.0.email"]').fill('e2e-artist@example.com')
    await page.locator('input[name="additionalPerformers.0.phone"]').fill('+33687654321')

    // Soumettre le formulaire
    const submitButton = page.getByRole('button', { name: /envoyer ma candidature/i })
    await expect(submitButton).toBeVisible({ timeout: 5000 })

    await submitButton.click()

    // La modal de sauvegarde de preset apparaît → cliquer "Envoyer sans enregistrer"
    const presetModal = page.getByRole('dialog')
    await expect(presetModal).toBeVisible({ timeout: 5000 })

    const [applicationResponse] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes('/shows-call/') &&
          res.url().includes('/applications') &&
          res.request().method() === 'POST'
      ),
      presetModal.getByRole('button', { name: /envoyer sans enregistrer/i }).click(),
    ])

    // Afficher le body en cas d'erreur pour faciliter le debug
    if (!applicationResponse.ok()) {
      const errorBody = await applicationResponse.text()
      throw new Error(
        `API returned ${applicationResponse.status()} ${applicationResponse.statusText()}: ${errorBody}`
      )
    }
    const responseBody = await applicationResponse.json()
    const application = responseBody.data?.application || responseBody.data || responseBody
    expect(application.status).toBe('PENDING')
    saveToState('showApplicationId', String(application.id))

    // Vérifier la redirection vers la liste des appels
    await page.waitForURL(
      (url) =>
        url.pathname.includes(`/editions/${editionId}/shows-call`) &&
        !url.pathname.includes('/apply'),
      { timeout: 10000 }
    )
  })

  // ──────────────────────────────────────────────
  // Phase 4 : Vérification de la candidature (côté organisateur)
  // ──────────────────────────────────────────────

  test('au moins une candidature en attente via API', async ({ page }) => {
    const { editionId } = loadState()
    const showCallId = loadFromState('showCallId')
    expect(showCallId).toBeTruthy()

    const data = await getShowCallApplications(page, editionId, showCallId!)
    const applications = data.applications || data.items || data
    expect(Array.isArray(applications)).toBe(true)
    expect(applications.length).toBeGreaterThanOrEqual(1)

    const e2eApp = applications.find(
      (a: { showTitle?: string }) => a.showTitle === 'E2E Spectacle de Jonglage'
    )
    expect(e2eApp).toBeTruthy()
    expect(e2eApp.status).toBe('PENDING')
  })

  test('la page des candidatures affiche la candidature soumise', async ({ page, goto }) => {
    const { editionId } = loadState()
    const showCallId = loadFromState('showCallId')

    await goto(`/editions/${editionId}/gestion/shows-call/${showCallId}/applications`, {
      waitUntil: 'hydration',
    })
    await page.waitForSelector('main', { timeout: 15000 })

    await expect(
      page.getByText(/E2E Artiste Jongleur|E2E Spectacle de Jonglage/i).first()
    ).toBeVisible({ timeout: 10000 })
  })

  // ──────────────────────────────────────────────
  // Phase 5 : Gestion des statuts de candidature
  // ──────────────────────────────────────────────

  test('accepter la candidature', async ({ page }) => {
    const { editionId } = loadState()
    const showCallId = loadFromState('showCallId')
    const applicationId = loadFromState('showApplicationId')
    expect(showCallId).toBeTruthy()
    expect(applicationId).toBeTruthy()

    await updateShowCallApplicationStatus(page, editionId, showCallId!, applicationId!, {
      status: 'ACCEPTED',
    })
  })

  test("la candidature est 'acceptée' via API", async ({ page }) => {
    const { editionId } = loadState()
    const showCallId = loadFromState('showCallId')
    expect(showCallId).toBeTruthy()

    const data = await getShowCallApplications(page, editionId, showCallId!)
    const applications = data.applications || data.items || data

    const e2eApp = applications.find(
      (a: { showTitle?: string }) => a.showTitle === 'E2E Spectacle de Jonglage'
    )
    expect(e2eApp).toBeTruthy()
    expect(e2eApp.status).toBe('ACCEPTED')
  })

  test('rejeter la candidature (ACCEPTED → PENDING → REJECTED)', async ({ page }) => {
    const { editionId } = loadState()
    const showCallId = loadFromState('showCallId')
    const applicationId = loadFromState('showApplicationId')
    expect(showCallId).toBeTruthy()
    expect(applicationId).toBeTruthy()

    // ACCEPTED → PENDING
    await updateShowCallApplicationStatus(page, editionId, showCallId!, applicationId!, {
      status: 'PENDING',
    })

    // PENDING → REJECTED
    await updateShowCallApplicationStatus(page, editionId, showCallId!, applicationId!, {
      status: 'REJECTED',
    })
  })

  test("la candidature est 'rejetée' via API", async ({ page }) => {
    const { editionId } = loadState()
    const showCallId = loadFromState('showCallId')
    expect(showCallId).toBeTruthy()

    const data = await getShowCallApplications(page, editionId, showCallId!)
    const applications = data.applications || data.items || data

    const e2eApp = applications.find(
      (a: { showTitle?: string }) => a.showTitle === 'E2E Spectacle de Jonglage'
    )
    expect(e2eApp).toBeTruthy()
    expect(e2eApp.status).toBe('REJECTED')
  })

  test('ajouter des notes organisateur à la candidature', async ({ page }) => {
    const { editionId } = loadState()
    const showCallId = loadFromState('showCallId')
    const applicationId = loadFromState('showApplicationId')
    expect(showCallId).toBeTruthy()
    expect(applicationId).toBeTruthy()

    await updateShowCallApplicationStatus(page, editionId, showCallId!, applicationId!, {
      organizerNotes: 'Note de test E2E - Bon spectacle mais pas adapté à cette édition',
    })
  })

  // ──────────────────────────────────────────────
  // Phase 6 : Page publique des appels ouverts
  // ──────────────────────────────────────────────

  test("la page des appels ouverts affiche l'appel", async ({ page, goto }) => {
    await expect(async () => {
      await goto('/shows-call/open', { waitUntil: 'hydration' })
      await page.waitForSelector('main', { timeout: 10000 })
      await expect(page.getByText(SHOW_CALL_NAME).first()).toBeVisible({ timeout: 3000 })
    }).toPass({ timeout: 30000, intervals: [3000] })
  })

  // ──────────────────────────────────────────────
  // Phase 7 : Mes candidatures artiste
  // ──────────────────────────────────────────────

  test('la page mes candidatures affiche la candidature', async ({ page, goto }) => {
    await expect(async () => {
      await goto('/profile/mes-candidatures-artiste', { waitUntil: 'hydration' })
      await page.waitForSelector('main', { timeout: 10000 })
      await expect(
        page.getByText(/E2E Spectacle de Jonglage|E2E Artiste Jongleur/i).first()
      ).toBeVisible({ timeout: 3000 })
    }).toPass({ timeout: 30000, intervals: [3000] })
  })

  // ──────────────────────────────────────────────
  // Nettoyage
  // ──────────────────────────────────────────────

  test("nettoyer : supprimer l'appel à spectacles et repasser OFFLINE", async ({ page }) => {
    const { editionId } = loadState()
    const showCallId = loadFromState('showCallId')

    if (showCallId) {
      await deleteShowCall(page, editionId, showCallId)
    }

    await setEditionStatus(page, editionId, 'OFFLINE')
  })
})
