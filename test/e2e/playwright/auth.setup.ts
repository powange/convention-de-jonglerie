import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { expect, test as setup } from '@nuxt/test-utils/playwright'

import { authFile, credentialsFile } from '../../../playwright.config'

// Génère un email unique pour chaque exécution des tests
const timestamp = Date.now()
const TEST_EMAIL = `e2e-test-${timestamp}@example.com`
const TEST_PASSWORD = 'TestPass123!'
const TEST_PSEUDO = `E2ETest${timestamp}`

/**
 * Extrait le code de vérification depuis les logs Docker.
 * Le serveur log "[DEV_VERIFICATION_CODE] XXXXXX" en mode dev (process.dev).
 */
function getVerificationCodeFromLogs(): string {
  const logs = execSync('docker compose -f docker-compose.dev.yml logs app --tail=200 2>&1', {
    encoding: 'utf-8',
    timeout: 10000,
  })

  const matches = [...logs.matchAll(/\[DEV_VERIFICATION_CODE]\s*(\d{6})/g)]
  if (matches.length === 0) {
    throw new Error('Code de vérification non trouvé dans les logs Docker')
  }
  return matches[matches.length - 1][1]
}

setup('create account and authenticate', async ({ page, goto }) => {
  // Étape 1 : Page de login → saisir l'email
  await goto('/login', { waitUntil: 'hydration' })
  await page.locator('input[type="email"], input[placeholder*="email" i]').fill(TEST_EMAIL)

  // Cliquer sur Confirmer et attendre la réponse de l'API check-email
  await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes('/api/auth/check-email') && res.status() === 200
    ),
    page.getByRole('button', { name: /confirmer/i }).click(),
  ])

  // Étape 2 : Email inconnu → page d'inscription avec les 2 switches de confirmation
  await page.getByTestId('confirm-email-access').waitFor({ timeout: 10000 })
  await page.getByTestId('confirm-email-access').click()
  await page.getByTestId('confirm-personal-account').click()

  // Étape 3 : Le formulaire d'inscription apparaît après les 2 confirmations
  await page.waitForSelector('input[type="password"]', { timeout: 5000 })

  // Remplir le pseudo (champ obligatoire)
  await page
    .locator('input[placeholder*="pseudo" i], input[placeholder*="utilisateur" i]')
    .fill(TEST_PSEUDO)

  // Remplir le mot de passe
  await page.locator('input[type="password"]').first().fill(TEST_PASSWORD)

  // Confirmer le mot de passe si le champ existe
  const passwordInputs = page.locator('input[type="password"]')
  if ((await passwordInputs.count()) >= 2) {
    await passwordInputs.nth(1).fill(TEST_PASSWORD)
  }

  // Soumettre l'inscription et attendre la réponse API
  const submitButton = page.getByRole('button', { name: /créer mon compte/i })
  await submitButton.scrollIntoViewIfNeeded()
  const [registerResponse] = await Promise.all([
    page.waitForResponse((res) => res.url().includes('/api/auth/register')),
    submitButton.click(),
  ])

  if (!registerResponse.ok()) {
    const body = await registerResponse.text().catch(() => 'impossible de lire le body')
    throw new Error(`Inscription échouée (${registerResponse.status()}): ${body}`)
  }

  // Étape 4 : Page de vérification email
  await page.waitForURL(/verify-email/, { timeout: 15000 })

  // Attendre que le code de vérification apparaisse dans les logs Docker
  let code = ''
  await expect(async () => {
    code = getVerificationCodeFromLogs()
  }).toPass({ timeout: 10000, intervals: [500] })

  // Saisir le code de vérification (UPinInput = 6 inputs séparés)
  const pinInputs = page.locator('input[data-pin-input-input]')
  const singleInput = page.locator('input[maxlength="6"], input[placeholder*="code" i]')

  if ((await pinInputs.count()) >= 6) {
    // UPinInput de Nuxt UI : cliquer sur le premier puis taper le code
    await pinInputs.first().click()
    await page.keyboard.type(code)
  } else if (await singleInput.isVisible().catch(() => false)) {
    await singleInput.fill(code)
  } else {
    // Fallback : taper le code au clavier
    await page.keyboard.type(code)
  }

  // Soumettre la vérification et attendre la réponse API
  const verifyButton = page.getByRole('button', { name: /vérifier le code/i })
  const [verifyResponse] = await Promise.all([
    page.waitForResponse((res) => res.url().includes('/api/auth/verify-email')),
    verifyButton.click(),
  ])

  if (!verifyResponse.ok()) {
    const body = await verifyResponse.text().catch(() => 'impossible de lire le body')
    throw new Error(`Vérification échouée (${verifyResponse.status()}): ${body}`)
  }

  // Attendre la redirection après vérification (hors /login et /verify-email)
  await page.waitForURL(
    (url) => !url.pathname.includes('/login') && !url.pathname.includes('/verify-email'),
    { timeout: 15000 }
  )

  // Sauvegarder la session (cookies inclus)
  await page.context().storageState({ path: authFile })

  // Sauvegarder les credentials pour les tests de connexion
  fs.mkdirSync(path.dirname(credentialsFile), { recursive: true })
  fs.writeFileSync(
    credentialsFile,
    JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      pseudo: TEST_PSEUDO,
    })
  )
})
