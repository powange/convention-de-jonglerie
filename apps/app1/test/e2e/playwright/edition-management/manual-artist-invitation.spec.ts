import { expect, test } from '@nuxt/test-utils/playwright'

import { apiPost, getInvitationTokenFromLogs, loadState } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Ajout MANUEL d'un artiste dont l'utilisateur n'existe pas encore :
 * l'organisateur crée un compte « en attente » et un email d'invitation (lien)
 * est envoyé. La personne active son compte via `/auth/invitation?token=...` en
 * choisissant son mot de passe, puis peut se reconnecter.
 *
 * Complète manual-artist-claim.spec (activation via le code /register) en couvrant
 * le nouveau flux d'invitation par lien.
 */
test.describe.serial("Ajout manuel d'un artiste → invitation par lien", () => {
  const ts = Date.now()
  const EMAIL = `e2e-artist-invite-${ts}@example.com`
  const PRENOM = 'ArtistePrenomInvite'
  const NOM = 'ArtisteNomInvite'
  const PASSWORD = 'InviteArtistPass123!'

  let userId: number
  let invitationToken = ''

  test("l'organisateur ajoute un artiste manuel (compte en attente + token d'invitation)", async ({
    page,
  }) => {
    const { editionId } = loadState()

    const res = await apiPost(page, `${BASE}/api/editions/${editionId}/artists`, {
      data: { email: EMAIL, prenom: PRENOM, nom: NOM },
    })
    expect(res.ok(), `POST /artists a échoué: ${await res.text()}`).toBe(true)

    // Récupérer le token d'invitation immédiatement après l'ajout (workers:1 →
    // le dernier [DEV_INVITATION_TOKEN] des logs correspond à cet ajout).
    await expect(async () => {
      invitationToken = getInvitationTokenFromLogs()
    }).toPass({ timeout: 10000, intervals: [500] })
    expect(invitationToken).toHaveLength(64)

    // Le compte est bien créé en attente (MANUAL, non vérifié)
    const list = await page.request.get(`${BASE}/api/editions/${editionId}/artists`)
    expect(list.ok()).toBe(true)
    const body = await list.json()
    const artists = body.data?.artists || body.artists || []
    const found = artists.find((a: { user: { email: string } }) => a.user.email === EMAIL)
    expect(found, `Artiste ${EMAIL} non trouvé dans la liste`).toBeDefined()
    expect(found.user.authProvider).toBe('MANUAL')
    userId = found.user.id
  })

  test("l'artiste active son compte via le lien d'invitation et choisit son mot de passe", async ({
    browser,
  }) => {
    // Contexte anonyme : aucun cookie de session organisateur
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await context.newPage()

    await page.goto(`${BASE}/auth/invitation?token=${invitationToken}`, {
      waitUntil: 'domcontentloaded',
    })

    // Avant activation : le header est en état déconnecté (bouton « Connexion »).
    const loginLink = page.getByRole('link', { name: 'Connexion', exact: true })
    await expect(loginLink).toBeVisible({ timeout: 10000 })

    // Remplir mot de passe + confirmation (2 champs type=password)
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

    // Écran de succès
    await expect(page.getByText(/compte activé/i).first()).toBeVisible({ timeout: 10000 })

    // RÉGRESSION : le header doit refléter l'état connecté SANS recharger la page
    // (le bouton « Connexion » disparaît car le store Pinia a été ré-hydraté).
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

  test("l'EditionArtist pointe toujours vers le même utilisateur (lien préservé)", async ({
    page,
  }) => {
    const { editionId } = loadState()
    const res = await page.request.get(`${BASE}/api/editions/${editionId}/artists`)
    expect(res.ok()).toBe(true)
    const body = await res.json()
    const artists = body.data?.artists || body.artists || []
    const found = artists.find((a: { user: { email: string } }) => a.user.email === EMAIL)
    expect(found, "L'EditionArtist doit toujours exister après l'activation").toBeDefined()
    expect(found.user.id).toBe(userId)
  })
})
