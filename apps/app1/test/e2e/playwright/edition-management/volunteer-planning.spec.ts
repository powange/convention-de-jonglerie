import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPost, enableVolunteers, loadState } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Smoke fonctionnel du planning bénévoles (layers/volunteers), non couvert jusqu'ici :
 * création d'un créneau (time slot), ajout d'un bénévole (create-user-and-add → candidature
 * ACCEPTED) et affectation du bénévole au créneau, puis nettoyage.
 */
test.describe.serial('Bénévoles — planning et affectations', () => {
  let slotId: number | null = null
  let assignmentId: number | null = null
  let volunteerUserId: number | null = null
  let applicationId: number | null = null
  const volunteerEmail = `benevole-planning-e2e-${Date.now()}@example.com`

  test.beforeAll(async () => {
    const { editionId } = loadState()
    if (!editionId) throw new Error('editionId manquant dans state.json (setup global non joué)')
  })

  test("activer les bénévoles via l'API", async ({ page }) => {
    const { editionId } = loadState()
    await enableVolunteers(page, String(editionId))
  })

  test('créer un créneau via API et le voir dans GET time-slots', async ({ page }) => {
    const { editionId } = loadState()
    /*
     * Le créneau doit tomber sur le PREMIER JOUR de l'édition, pas seulement dans sa plage.
     *
     * Le planning s'ouvre sur ce premier jour, « Précédent » désactivé, et ne rend pas les
     * suivants : il faudrait cliquer « Suivant ». Or l'édition de test commence à J+7 à L'HEURE
     * DE L'EXÉCUTION (data.setup.ts:34-37), et le créneau était placé à J+7,5 — soit douze heures
     * plus tard. Lancé avant midi UTC, il restait sur le premier jour ; lancé après, il basculait
     * au lendemain et « Accueil E2E » n'était plus affiché. Le test ne passait donc que le matin :
     * vert à 11 h 20 sur la PR #555, rouge à 12 h 07 et 12 h 28 sur la #556, pour des lots
     * identiques.
     *
     * Une heure après le début, et non douze : le créneau reste le même jour que celui sur lequel
     * le calendrier s'ouvre.
     *
     * ⚠️ Il reste une fenêtre non couverte : une exécution démarrée entre 23 h et minuit UTC
     * ferait de nouveau basculer le créneau au lendemain. La corriger pour de bon demande de
     * normaliser les dates de `data.setup.ts` à minuit, ce qui touche TOUS les lots et mérite sa
     * propre vérification.
     */
    const start = new Date(Date.now() + 7 * 24 * 3600_000 + 3600_000)
    const end = new Date(start.getTime() + 4 * 3600_000)

    const response = await apiPost(page, `${BASE}/api/editions/${editionId}/volunteer-time-slots`, {
      data: {
        title: 'Accueil E2E',
        description: "Tenue de l'accueil",
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString(),
        maxVolunteers: 5,
      },
    })
    expect(response.ok(), `POST time-slots a échoué: ${await response.text()}`).toBe(true)
    // Le point d'API rend une liste : un créneau d'ordinaire, autant que de journées quand la
    // création est récurrente.
    const body = await response.json()
    slotId = (body?.data?.timeSlots ?? [])[0]?.id
    expect(slotId).toBeTruthy()

    const list = await page.request.get(`${BASE}/api/editions/${editionId}/volunteer-time-slots`)
    expect(list.ok()).toBe(true)
    const listBody = await list.json()
    const slots = Array.isArray(listBody) ? listBody : (listBody?.data ?? [])
    expect(slots.some((s: { id: number }) => s.id === slotId)).toBe(true)
  })

  test('la page planning est accessible', async ({ page, goto }) => {
    const { editionId } = loadState()
    // La page charge un calendrier lourd + un contrôle d'accès → re-navigation tolérante.
    await expect(async () => {
      await goto(`/editions/${editionId}/gestion/volunteers/planning`, { waitUntil: 'hydration' })
      await expect(
        // La partie stable du titre, et non son libellé complet : ce dernier vient d'une clé de
        // traduction et a déjà changé une fois, faisant tomber ce test.
        page.getByRole('heading', { name: /planning/i }).first()
      ).toBeVisible({ timeout: 8000 })
    }).toPass({ timeout: 40000, intervals: [2000, 3000, 5000] })
  })

  /**
   * Le bouton d'enregistrement de la modification, et non le contenu des champs : c'est lui que
   * l'utilisateur trouve désactivé, et il l'était parce que la page lisait `.start` / `.end` là où
   * l'API rend `startDateTime` / `endDateTime`. `undefined` devenait une chaîne vide, les deux
   * champs d'horaire s'ouvraient vides, et `isFormValid` refusait le bouton.
   *
   * Aucun test unitaire de la page ni de la modale ne pouvait le voir : le défaut vit entre les
   * deux, dans le nom d'un champ que l'une passe et que l'autre attend.
   */
  test('un créneau existant s’ouvre en modification avec ses horaires', async ({ page, goto }) => {
    const { editionId } = loadState()

    await expect(async () => {
      await goto(`/editions/${editionId}/gestion/volunteers/planning`, { waitUntil: 'hydration' })
      await expect(page.getByText('Accueil E2E').first()).toBeVisible({ timeout: 8000 })
    }).toPass({ timeout: 40000, intervals: [2000, 3000, 5000] })

    await page.getByText('Accueil E2E').first().click()

    // Le sous-titre identifie l'action sans ambiguïté : « Modifier le créneau » sert aussi de
    // titre à la modale qui s'ouvre ensuite.
    const ouvrirLaModification = page.getByText("Modifier le titre, les horaires et l'équipe")
    await expect(ouvrirLaModification).toBeVisible({ timeout: 8000 })
    await ouvrirLaModification.click()

    const enregistrer = page.getByRole('button', { name: 'Enregistrer' })
    await expect(enregistrer).toBeVisible({ timeout: 8000 })
    await expect(enregistrer).toBeEnabled()
  })

  test('ajouter un bénévole (create-user-and-add) → candidature ACCEPTED', async ({ page }) => {
    const { editionId } = loadState()
    const response = await apiPost(
      page,
      `${BASE}/api/editions/${editionId}/volunteers/create-user-and-add`,
      { data: { email: volunteerEmail, prenom: 'Bénévole', nom: 'PlanningE2E' } }
    )
    expect(response.ok(), `create-user-and-add a échoué: ${await response.text()}`).toBe(true)
    const body = await response.json()
    const data = body?.data ?? body
    volunteerUserId = data?.user?.id
    applicationId = data?.application?.id
    expect(volunteerUserId).toBeTruthy()
    expect(applicationId).toBeTruthy()
    expect(data?.application?.status).toBe('ACCEPTED')
  })

  test('affecter le bénévole au créneau et vérifier via GET assignments', async ({ page }) => {
    const { editionId } = loadState()
    if (!slotId || !volunteerUserId) throw new Error('slotId/volunteerUserId manquant')

    const response = await apiPost(
      page,
      `${BASE}/api/editions/${editionId}/volunteer-time-slots/${slotId}/assignments`,
      { data: { userId: volunteerUserId } }
    )
    expect(response.ok(), `assignment a échoué: ${await response.text()}`).toBe(true)
    const body = await response.json()
    assignmentId = (body?.data ?? body)?.id
    expect(assignmentId).toBeTruthy()

    const list = await page.request.get(
      `${BASE}/api/editions/${editionId}/volunteer-time-slots/${slotId}/assignments`
    )
    expect(list.ok()).toBe(true)
    const listBody = await list.json()
    const assignments = Array.isArray(listBody) ? listBody : (listBody?.data ?? [])
    expect(assignments.some((a: { userId?: number }) => a.userId === volunteerUserId)).toBe(true)
  })

  test('nettoyage : affectation, créneau, candidature, désactivation', async ({ page }) => {
    const { editionId } = loadState()
    if (assignmentId && slotId) {
      const del = await apiDelete(
        page,
        `${BASE}/api/editions/${editionId}/volunteer-time-slots/${slotId}/assignments/${assignmentId}`
      )
      expect(del.ok()).toBe(true)
    }
    if (slotId) {
      const del = await apiDelete(
        page,
        `${BASE}/api/editions/${editionId}/volunteer-time-slots/${slotId}`
      )
      expect(del.ok()).toBe(true)
    }
    if (applicationId) {
      await apiDelete(
        page,
        `${BASE}/api/editions/${editionId}/volunteers/applications/${applicationId}`
      )
    }
  })
})
