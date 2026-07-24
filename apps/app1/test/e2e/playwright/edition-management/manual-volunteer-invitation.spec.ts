import { expect, test } from '@nuxt/test-utils/playwright'

import { apiPost, enableVolunteers, getInvitationTokenFromLogs, loadState } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Ajout MANUEL d'un bénévole dont l'utilisateur n'existe pas encore
 * (`create-user-and-add`) : l'organisateur crée un compte « en attente » + une
 * candidature ACCEPTED, et un email d'invitation (lien) est envoyé. La personne
 * active son compte via `/auth/invitation?token=...` puis peut se reconnecter.
 */
test.describe.serial("Ajout manuel d'un bénévole → invitation par lien", () => {
  const ts = Date.now()
  const EMAIL = `e2e-volunteer-invite-${ts}@example.com`
  const PRENOM = 'BenevolePrenomInvite'
  const NOM = 'BenevoleNomInvite'
  const PASSWORD = 'InviteVolunteerPass123!'

  let invitationToken = ''

  test('activer les bénévoles via API', async ({ page }) => {
    const { editionId } = loadState()
    await enableVolunteers(page, editionId)
  })

  test("l'organisateur crée + ajoute un bénévole manuel (compte en attente + candidature ACCEPTED)", async ({
    page,
  }) => {
    const { editionId } = loadState()

    const res = await apiPost(
      page,
      `${BASE}/api/editions/${editionId}/volunteers/create-user-and-add`,
      { data: { email: EMAIL, prenom: PRENOM, nom: NOM } }
    )
    expect(res.ok(), `create-user-and-add a échoué: ${await res.text()}`).toBe(true)

    const body = await res.json()
    const data = body.data ?? body
    expect(data.user?.email).toBe(EMAIL)
    expect(data.application?.status).toBe('ACCEPTED')

    // Token d'invitation récupéré juste après l'ajout (workers:1)
    await expect(async () => {
      invitationToken = getInvitationTokenFromLogs()
    }).toPass({ timeout: 10000, intervals: [500] })
    expect(invitationToken).toHaveLength(64)
  })

  test("le bénévole active son compte via le lien d'invitation et choisit son mot de passe", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await context.newPage()

    await page.goto(`${BASE}/auth/invitation?token=${invitationToken}`, {
      waitUntil: 'domcontentloaded',
    })

    // Avant activation : header déconnecté (bouton « Connexion »).
    const loginLink = page.getByRole('link', { name: 'Connexion', exact: true })
    await expect(loginLink).toBeVisible({ timeout: 10000 })

    const pw = page.locator('input[type="password"]')
    await expect(pw.first()).toBeVisible({ timeout: 10000 })
    await pw.first().fill(PASSWORD)
    if ((await pw.count()) >= 2) await pw.nth(1).fill(PASSWORD)

    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/auth/accept-invitation')),
      page.getByRole('button', { name: /activer mon compte/i }).click(),
    ])
    expect(
      resp.ok(),
      `accept-invitation attendu 200, reçu ${resp.status()}: ${await resp.text()}`
    ).toBe(true)

    await expect(page.getByText(/compte activé/i).first()).toBeVisible({ timeout: 10000 })

    // RÉGRESSION : le header passe en connecté sans recharger la page.
    await expect(loginLink).toBeHidden({ timeout: 10000 })

    await context.close()
  })

  test('le compte activé peut se connecter avec le mot de passe choisi', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await context.newPage()

    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await page.locator('input[type="email"]').fill(EMAIL)
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/auth/check-email') && r.status() === 200),
      page.getByRole('button', { name: /confirmer/i }).click(),
    ])

    const passwordInput = page.locator('input[type="password"]').first()
    await expect(passwordInput).toBeVisible({ timeout: 5000 })
    await passwordInput.fill(PASSWORD)

    const [loginResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/auth/login')),
      page.getByRole('button', { name: /se connecter/i }).click(),
    ])
    expect(
      loginResponse.ok(),
      `login attendu 200, reçu ${loginResponse.status()}: ${await loginResponse.text()}`
    ).toBe(true)

    await context.close()
  })
})
