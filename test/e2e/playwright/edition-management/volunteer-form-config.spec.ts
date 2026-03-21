import { expect, test } from '@nuxt/test-utils/playwright'

import {
  disableVolunteers,
  enableVolunteers,
  getVolunteerSettings,
  loadState,
  setEditionStatus,
  updateVolunteerSettings,
} from '../helpers'

const BASE_URL = 'http://localhost:3000'

test.describe.serial('Personnalisation du formulaire de candidature bénévole', () => {
  // ──────────────────────────────────────────────
  // Setup : activer les bénévoles, ouvrir le recrutement, publier
  // ──────────────────────────────────────────────

  test('activer les bénévoles et ouvrir le recrutement', async ({ page }) => {
    const { editionId } = loadState()

    await enableVolunteers(page, editionId)
    // Réinitialiser tous les toggles à false pour garantir un état propre
    await updateVolunteerSettings(page, editionId, {
      open: true,
      askDiet: false,
      askAllergies: false,
      askEmergencyContact: false,
      askPets: false,
      askMinors: false,
      askVehicle: false,
      askSkills: false,
      askExperience: false,
      askTimePreferences: false,
      askCompanion: false,
      askAvoidList: false,
    })
    await setEditionStatus(page, editionId, 'PUBLISHED')
  })

  // ──────────────────────────────────────────────
  // Phase 1 : Vérifier l'état par défaut (tous les toggles désactivés)
  // ──────────────────────────────────────────────

  test('par défaut, tous les toggles du formulaire sont désactivés', async ({ page }) => {
    const { editionId } = loadState()

    const settings = await getVolunteerSettings(page, editionId)
    expect(settings.askDiet).toBe(false)
    expect(settings.askAllergies).toBe(false)
    expect(settings.askPets).toBe(false)
    expect(settings.askMinors).toBe(false)
    expect(settings.askVehicle).toBe(false)
    expect(settings.askCompanion).toBe(false)
    expect(settings.askAvoidList).toBe(false)
    expect(settings.askSkills).toBe(false)
    expect(settings.askExperience).toBe(false)
    expect(settings.askTimePreferences).toBe(false)
    expect(settings.askEmergencyContact).toBe(false)
  })

  test('la modale de candidature par défaut ne montre que les champs obligatoires', async ({
    page,
    goto,
  }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/volunteers`, { waitUntil: 'hydration' })
    await page.waitForSelector('h3', { timeout: 15000 })

    await page.getByRole('button', { name: /postuler/i }).click()
    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible({ timeout: 5000 })

    // Champs toujours visibles
    await expect(modal.getByLabel(/prénom/i).first()).toBeVisible()
    await expect(modal.getByLabel(/nom/i).first()).toBeVisible()

    // Sections optionnelles absentes
    await expect(modal.getByText(/régime alimentaire/i)).not.toBeVisible({ timeout: 2000 })
    await expect(modal.getByText(/allergies/i).first()).not.toBeVisible({ timeout: 1000 })
    await expect(modal.getByText(/animal de compagnie/i)).not.toBeVisible({ timeout: 1000 })
    await expect(modal.getByText(/personne mineure/i)).not.toBeVisible({ timeout: 1000 })
    await expect(modal.getByText(/véhicule à disposition/i)).not.toBeVisible({ timeout: 1000 })
    await expect(modal.getByText(/compétences et certifications/i)).not.toBeVisible({
      timeout: 1000,
    })
    await expect(modal.getByText(/déjà été bénévole/i)).not.toBeVisible({
      timeout: 1000,
    })
    await expect(modal.getByText(/créneaux horaires préférés/i)).not.toBeVisible({ timeout: 1000 })
    await expect(modal.getByText(/bénévoles avec qui j'aimerais/i)).not.toBeVisible({
      timeout: 1000,
    })
    await expect(modal.getByText(/bénévoles avec qui je préfère ne pas/i)).not.toBeVisible({
      timeout: 1000,
    })

    await page.keyboard.press('Escape')
  })

  // ──────────────────────────────────────────────
  // Phase 2 : Activer des champs via l'UI de config et vérifier la modale
  // ──────────────────────────────────────────────

  test('la page de configuration du formulaire est accessible', async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion/volunteers/form`, { waitUntil: 'hydration' })
    await page.waitForSelector('main', { timeout: 15000 })

    // Le titre de la page est visible
    await expect(
      page.getByText(/formulaire.*appel.*bénévole|volunteer.*form/i).first()
    ).toBeVisible({ timeout: 10000 })

    // Les sections de configuration sont visibles
    await expect(page.getByText(/présence du bénévole/i).first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/préférences de créneaux/i).first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/informations personnelles/i).first()).toBeVisible({
      timeout: 5000,
    })
    await expect(page.getByText(/ce que le bénévole peut apporter/i).first()).toBeVisible({
      timeout: 5000,
    })
  })

  test('activer les champs "informations personnelles" via API', async ({ page }) => {
    const { editionId } = loadState()

    await updateVolunteerSettings(page, editionId, {
      askDiet: true,
      askAllergies: true,
      askEmergencyContact: true,
      askPets: true,
      askMinors: true,
    })

    // Vérifier la persistance
    const settings = await getVolunteerSettings(page, editionId)
    expect(settings.askDiet).toBe(true)
    expect(settings.askAllergies).toBe(true)
    expect(settings.askEmergencyContact).toBe(true)
    expect(settings.askPets).toBe(true)
    expect(settings.askMinors).toBe(true)
  })

  test('la modale affiche les champs "informations personnelles" activés', async ({
    page,
    goto,
  }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/volunteers`, { waitUntil: 'hydration' })
    await page.waitForSelector('h3', { timeout: 15000 })

    await page.getByRole('button', { name: /postuler/i }).click()
    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible({ timeout: 5000 })

    // Les champs activés doivent être visibles
    await expect(modal.getByText(/régime alimentaire/i).first()).toBeVisible({ timeout: 5000 })
    await expect(modal.getByText(/allergies/i).first()).toBeVisible({ timeout: 3000 })
    await expect(modal.getByText(/contact d'urgence/i).first()).toBeVisible({ timeout: 3000 })
    await expect(modal.getByText(/animal de compagnie/i).first()).toBeVisible({ timeout: 3000 })
    await expect(modal.getByText(/personne mineure/i).first()).toBeVisible({ timeout: 3000 })

    // Les champs non activés restent absents
    await expect(modal.getByText(/véhicule à disposition/i)).not.toBeVisible({ timeout: 1000 })
    await expect(modal.getByText(/compétences et certifications/i)).not.toBeVisible({
      timeout: 1000,
    })

    await page.keyboard.press('Escape')
  })

  // ──────────────────────────────────────────────
  // Phase 3 : Activer les champs "ce que vous pouvez apporter"
  // ──────────────────────────────────────────────

  test('activer les champs "ce que vous pouvez apporter" via API', async ({ page }) => {
    const { editionId } = loadState()

    await updateVolunteerSettings(page, editionId, {
      askVehicle: true,
      askSkills: true,
      askExperience: true,
    })

    const settings = await getVolunteerSettings(page, editionId)
    expect(settings.askVehicle).toBe(true)
    expect(settings.askSkills).toBe(true)
    expect(settings.askExperience).toBe(true)
  })

  test('la modale affiche les champs "ce que vous pouvez apporter" activés', async ({
    page,
    goto,
  }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/volunteers`, { waitUntil: 'hydration' })
    await page.waitForSelector('h3', { timeout: 15000 })

    await page.getByRole('button', { name: /postuler/i }).click()
    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible({ timeout: 5000 })

    await expect(modal.getByText(/véhicule à disposition/i).first()).toBeVisible({ timeout: 5000 })
    await expect(modal.getByText(/compétences et certifications/i).first()).toBeVisible({
      timeout: 3000,
    })
    await expect(modal.getByText(/déjà été bénévole/i).first()).toBeVisible({ timeout: 3000 })

    await page.keyboard.press('Escape')
  })

  // ──────────────────────────────────────────────
  // Phase 4 : Activer les champs "préférences de créneaux"
  // ──────────────────────────────────────────────

  test('activer les champs "préférences de créneaux" via API', async ({ page }) => {
    const { editionId } = loadState()

    await updateVolunteerSettings(page, editionId, {
      askTimePreferences: true,
      askCompanion: true,
      askAvoidList: true,
    })

    const settings = await getVolunteerSettings(page, editionId)
    expect(settings.askTimePreferences).toBe(true)
    expect(settings.askCompanion).toBe(true)
    expect(settings.askAvoidList).toBe(true)
  })

  test('la modale affiche les champs "préférences de créneaux" activés', async ({
    page,
    goto,
  }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/volunteers`, { waitUntil: 'hydration' })
    await page.waitForSelector('h3', { timeout: 15000 })

    await page.getByRole('button', { name: /postuler/i }).click()
    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible({ timeout: 5000 })

    await expect(modal.getByText(/créneaux horaires préférés/i).first()).toBeVisible({
      timeout: 5000,
    })
    await expect(modal.getByText(/bénévoles avec qui j'aimerais/i).first()).toBeVisible({
      timeout: 3000,
    })
    await expect(modal.getByText(/bénévoles avec qui je préfère ne pas/i).first()).toBeVisible({
      timeout: 3000,
    })

    await page.keyboard.press('Escape')
  })

  // ──────────────────────────────────────────────
  // Phase 5 : Désactiver des champs et vérifier qu'ils disparaissent
  // ──────────────────────────────────────────────

  test('désactiver tous les champs optionnels via API', async ({ page }) => {
    const { editionId } = loadState()

    await updateVolunteerSettings(page, editionId, {
      askDiet: false,
      askAllergies: false,
      askEmergencyContact: false,
      askPets: false,
      askMinors: false,
      askVehicle: false,
      askSkills: false,
      askExperience: false,
      askTimePreferences: false,
      askCompanion: false,
      askAvoidList: false,
    })

    const settings = await getVolunteerSettings(page, editionId)
    expect(settings.askDiet).toBe(false)
    expect(settings.askAllergies).toBe(false)
    expect(settings.askPets).toBe(false)
    expect(settings.askMinors).toBe(false)
    expect(settings.askVehicle).toBe(false)
    expect(settings.askSkills).toBe(false)
    expect(settings.askExperience).toBe(false)
    expect(settings.askTimePreferences).toBe(false)
    expect(settings.askCompanion).toBe(false)
    expect(settings.askAvoidList).toBe(false)
    expect(settings.askEmergencyContact).toBe(false)
  })

  test('la modale ne montre plus les champs désactivés', async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/volunteers`, { waitUntil: 'hydration' })
    await page.waitForSelector('h3', { timeout: 15000 })

    await page.getByRole('button', { name: /postuler/i }).click()
    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible({ timeout: 5000 })

    // Tous les champs optionnels doivent être absents
    await expect(modal.getByText(/régime alimentaire/i)).not.toBeVisible({ timeout: 2000 })
    await expect(modal.getByText(/allergies/i).first()).not.toBeVisible({ timeout: 1000 })
    await expect(modal.getByText(/animal de compagnie/i)).not.toBeVisible({ timeout: 1000 })
    await expect(modal.getByText(/personne mineure/i)).not.toBeVisible({ timeout: 1000 })
    await expect(modal.getByText(/véhicule à disposition/i)).not.toBeVisible({ timeout: 1000 })
    await expect(modal.getByText(/compétences et certifications/i)).not.toBeVisible({
      timeout: 1000,
    })
    await expect(modal.getByText(/créneaux horaires préférés/i)).not.toBeVisible({ timeout: 1000 })

    // Les champs obligatoires restent visibles
    await expect(modal.getByLabel(/prénom/i).first()).toBeVisible()
    await expect(modal.getByLabel(/nom/i).first()).toBeVisible()

    await page.keyboard.press('Escape')
  })

  // ──────────────────────────────────────────────
  // Phase 6 : Activer un toggle via l'UI de config (pas via API)
  // ──────────────────────────────────────────────

  test('activer un toggle via la page de configuration UI', async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion/volunteers/form`, { waitUntil: 'hydration' })
    await page.waitForSelector('main', { timeout: 15000 })

    // Trouver et cliquer sur le switch "Demander le régime alimentaire"
    const dietSwitch = page.getByText(/demander le régime alimentaire/i)
    await expect(dietSwitch).toBeVisible({ timeout: 10000 })
    await dietSwitch.click()

    // Attendre la sauvegarde automatique
    await page.waitForResponse(
      (res) => res.url().includes('/volunteers/settings') && res.request().method() === 'PATCH',
      { timeout: 5000 }
    )

    // Vérifier via API que le changement est persisté
    const settings = await getVolunteerSettings(page, editionId)
    expect(settings.askDiet).toBe(true)
  })

  test('le champ activé via UI apparaît dans la modale publique', async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/volunteers`, { waitUntil: 'hydration' })
    await page.waitForSelector('h3', { timeout: 15000 })

    await page.getByRole('button', { name: /postuler/i }).click()
    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible({ timeout: 5000 })

    // Le régime alimentaire activé via UI doit être visible
    await expect(modal.getByText(/régime alimentaire/i).first()).toBeVisible({ timeout: 5000 })

    await page.keyboard.press('Escape')
  })

  // ──────────────────────────────────────────────
  // Phase 7 : Vérifier la persistance des settings après rechargement
  // ──────────────────────────────────────────────

  test('les settings persistent après rechargement de la page de config', async ({
    page,
    goto,
  }) => {
    const { editionId } = loadState()

    // Activer plusieurs champs via API
    await updateVolunteerSettings(page, editionId, {
      askDiet: true,
      askAllergies: true,
      askVehicle: true,
    })

    // Aller sur la page de config
    await goto(`/editions/${editionId}/gestion/volunteers/form`, { waitUntil: 'hydration' })
    await page.waitForSelector('main', { timeout: 15000 })

    // Vérifier que les switches sont cochés (les labels des switches activés)
    // On vérifie via l'API que les settings sont bien persistées
    const settings = await getVolunteerSettings(page, editionId)
    expect(settings.askDiet).toBe(true)
    expect(settings.askAllergies).toBe(true)
    expect(settings.askVehicle).toBe(true)
  })

  // ──────────────────────────────────────────────
  // Nettoyage
  // ──────────────────────────────────────────────

  test('nettoyer : désactiver tous les toggles, fermer le recrutement, repasser OFFLINE', async ({
    page,
  }) => {
    const { editionId } = loadState()

    // Remettre tous les toggles à false
    await updateVolunteerSettings(page, editionId, {
      open: false,
      askDiet: false,
      askAllergies: false,
      askEmergencyContact: false,
      askPets: false,
      askMinors: false,
      askVehicle: false,
      askSkills: false,
      askExperience: false,
      askTimePreferences: false,
      askCompanion: false,
      askAvoidList: false,
    })

    await disableVolunteers(page, editionId)
    await setEditionStatus(page, editionId, 'OFFLINE')
  })
})
