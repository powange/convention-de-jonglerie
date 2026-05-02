import { expect, test } from '@nuxt/test-utils/playwright'

import { getVerificationCodeFromLogs, loadState } from '../helpers'

const BASE_URL = 'http://localhost:3000'

/**
 * Vérifie qu'une personne ajoutée par l'organisateur comme artiste manuel
 * (User authProvider=MANUAL, password null) peut "réclamer" son compte en
 * s'inscrivant sur le site avec le même email — sans créer de doublon et en
 * conservant son lien EditionArtist.
 *
 * Flow couvert :
 *   1. Organisateur POST /api/editions/[id]/artists (création MANUAL)
 *   2. Visiteur (browser context séparé, sans cookie) POST /api/auth/register
 *      → activation au lieu de 409
 *   3. Visiteur POST /api/auth/verify-email avec le code envoyé
 *      → bascule authProvider MANUAL → email
 *   4. Visiteur peut se connecter via UI avec le password choisi
 *   5. L'EditionArtist côté organisateur pointe toujours vers le même userId
 *      (preuve que rien n'a été doublé/cassé)
 */
test.describe.serial("Activation d'un compte MANUAL via /register", () => {
  const timestamp = Date.now()
  const ARTIST_EMAIL = `e2e-manual-artist-${timestamp}@example.com`
  const ARTIST_PRENOM = 'PrenomOrga'
  const ARTIST_NOM = 'NomOrga'
  const NEW_PASSWORD = 'NewArtistPass123!'
  const NEW_PSEUDO = `claim_artist_${timestamp}`

  let createdArtistUserId: number

  test("l'organisateur ajoute un artiste manuel via API", async ({ page }) => {
    const { editionId } = loadState()

    const response = await page.request.post(`${BASE_URL}/api/editions/${editionId}/artists`, {
      data: {
        email: ARTIST_EMAIL,
        prenom: ARTIST_PRENOM,
        nom: ARTIST_NOM,
      },
    })

    expect(response.ok(), `POST /artists a échoué: ${await response.text()}`).toBe(true)

    // Récupérer la liste pour stocker l'userId créé (sera vérifié à la fin)
    const listResponse = await page.request.get(`${BASE_URL}/api/editions/${editionId}/artists`)
    expect(listResponse.ok()).toBe(true)
    const listBody = await listResponse.json()
    const artists = listBody.data?.artists || listBody.artists || []
    const found = artists.find((a: any) => a.user.email === ARTIST_EMAIL)
    expect(found, `Artiste ${ARTIST_EMAIL} non trouvé dans la liste`).toBeDefined()
    expect(found.user.authProvider).toBe('MANUAL')
    createdArtistUserId = found.user.id
  })

  test("un visiteur peut s'inscrire via l'UI avec l'email de l'artiste manuel (activation)", async ({
    browser,
  }) => {
    // Nouveau context sans aucun cookie de session organisateur
    const context = await browser.newContext()
    const page = await context.newPage()

    // 1. Aller sur /login et saisir l'email du MANUAL
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' })
    await page.locator('input[type="email"]').fill(ARTIST_EMAIL)

    // check-email doit retourner canActivate: true → l'UI passe en mode register
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/auth/check-email') && res.status() === 200
      ),
      page.getByRole('button', { name: /confirmer/i }).click(),
    ])

    // 2. L'UI doit présenter le formulaire d'inscription (pas le password)
    await page.getByTestId('confirm-email-access').waitFor({ timeout: 10000 })
    await page.getByTestId('confirm-email-access').click()
    await page.getByTestId('confirm-personal-account').click()

    // Remplir pseudo + password
    await page
      .locator('input[placeholder*="pseudo" i], input[placeholder*="utilisateur" i]')
      .fill(NEW_PSEUDO)
    await page.locator('input[type="password"]').first().fill(NEW_PASSWORD)
    const passwordInputs = page.locator('input[type="password"]')
    if ((await passwordInputs.count()) >= 2) {
      await passwordInputs.nth(1).fill(NEW_PASSWORD)
    }

    // 3. Soumettre le register : doit retourner 200 (activation), pas 409
    const submitButton = page.getByRole('button', { name: /créer mon compte/i })
    await submitButton.scrollIntoViewIfNeeded()
    const [registerResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/auth/register')),
      submitButton.click(),
    ])
    expect(
      registerResponse.ok(),
      `register attendu 200, reçu ${registerResponse.status()}: ${await registerResponse.text()}`
    ).toBe(true)

    // 4. Page de vérification email
    await page.waitForURL(/verify-email/, { timeout: 15000 })

    // 5. Récupérer le code de vérification depuis les logs
    let code = ''
    await expect(async () => {
      code = getVerificationCodeFromLogs()
    }).toPass({ timeout: 10000, intervals: [500] })

    // 6. Saisir le code (UPinInput = 6 inputs séparés)
    const pinInputs = page.locator('input[data-pin-input-input]')
    if ((await pinInputs.count()) >= 6) {
      await pinInputs.first().click()
      await page.keyboard.type(code)
    } else {
      await page.keyboard.type(code)
    }

    const verifyButton = page.getByRole('button', { name: /vérifier le code/i })
    const [verifyResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/auth/verify-email')),
      verifyButton.click(),
    ])
    expect(
      verifyResponse.ok(),
      `verify-email attendu 200, reçu ${verifyResponse.status()}: ${await verifyResponse.text()}`
    ).toBe(true)

    await context.close()
  })

  test('le compte activé peut se connecter via UI avec le mot de passe choisi', async ({
    browser,
  }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' })

    await page.locator('input[type="email"]').fill(ARTIST_EMAIL)
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/auth/check-email') && res.status() === 200
      ),
      page.getByRole('button', { name: /confirmer/i }).click(),
    ])

    const passwordInput = page.locator('input[type="password"]').first()
    await expect(passwordInput).toBeVisible({ timeout: 5000 })
    await passwordInput.fill(NEW_PASSWORD)

    const [loginResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/auth/login')),
      page.getByRole('button', { name: /se connecter/i }).click(),
    ])

    expect(
      loginResponse.ok(),
      `login attendu 200, reçu ${loginResponse.status()}: ${await loginResponse.text()}`
    ).toBe(true)

    await context.close()
  })

  test("l'EditionArtist pointe toujours vers le même user (lien préservé) avec authProvider=email", async ({
    page,
  }) => {
    const { editionId } = loadState()

    const response = await page.request.get(`${BASE_URL}/api/editions/${editionId}/artists`)
    expect(response.ok()).toBe(true)
    const body = await response.json()
    const artists = body.data?.artists || body.artists || []

    const found = artists.find((a: any) => a.user.email === ARTIST_EMAIL)
    expect(found, "L'EditionArtist doit toujours exister après l'activation").toBeDefined()
    // Même userId : pas de doublon créé
    expect(found.user.id).toBe(createdArtistUserId)
    // authProvider a basculé MANUAL → email après la vérification du code
    expect(found.user.authProvider).toBe('email')
    // Le pseudo choisi par l'utilisateur a remplacé celui auto-généré
    expect(found.user.pseudo).toBe(NEW_PSEUDO)
    // Les nom/prénom saisis par l'organisateur ont été conservés (non fournis au register)
    expect(found.user.prenom).toBe(ARTIST_PRENOM)
    expect(found.user.nom).toBe(ARTIST_NOM)
  })
})
