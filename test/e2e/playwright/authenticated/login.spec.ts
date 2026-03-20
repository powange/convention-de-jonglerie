import fs from 'node:fs'

import { expect, test } from '@nuxt/test-utils/playwright'

import { credentialsFile } from '../../../../playwright.config'

interface E2ECredentials {
  email: string
  password: string
  pseudo: string
}

function loadCredentials(): E2ECredentials {
  if (!fs.existsSync(credentialsFile)) {
    throw new Error(
      `Fichier de credentials introuvable: ${credentialsFile}. Lancer le setup d'abord.`
    )
  }
  return JSON.parse(fs.readFileSync(credentialsFile, 'utf-8'))
}

test.describe('Connexion avec un compte E2E existant', () => {
  // Ce test utilise un contexte VIERGE (sans storageState) pour simuler un utilisateur déconnecté
  test.use({ storageState: { cookies: [], origins: [] } })

  test('connexion via email + mot de passe', async ({ page, goto }) => {
    const { email, password } = loadCredentials()

    // Étape 1 : Saisir l'email
    await goto('/login', { waitUntil: 'hydration' })
    await page.locator('input[type="email"]').fill(email)

    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/auth/check-email') && res.status() === 200
      ),
      page.getByRole('button', { name: /confirmer/i }).click(),
    ])

    // Étape 2 : Email connu → champ mot de passe
    const passwordInput = page.locator('input[type="password"]')
    await expect(passwordInput).toBeVisible({ timeout: 5000 })
    await passwordInput.fill(password)

    // Soumettre et attendre la connexion
    await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/auth/login') && res.status() === 200),
      page.getByRole('button', { name: /se connecter/i }).click(),
    ])

    // Vérifier la redirection vers l'accueil (hors /login)
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 })
    expect(page.url()).not.toContain('/login')
  })

  test('affiche une erreur avec un mauvais mot de passe', async ({ page, goto }) => {
    const { email } = loadCredentials()

    await goto('/login', { waitUntil: 'hydration' })
    await page.locator('input[type="email"]').fill(email)

    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/auth/check-email') && res.status() === 200
      ),
      page.getByRole('button', { name: /confirmer/i }).click(),
    ])

    // Saisir un mauvais mot de passe
    const passwordInput = page.locator('input[type="password"]')
    await expect(passwordInput).toBeVisible({ timeout: 5000 })
    await passwordInput.fill('MauvaisMotDePasse123!')

    await page.getByRole('button', { name: /se connecter/i }).click()

    // Un toast d'erreur doit apparaître
    await expect(page.getByText(/mot de passe incorrect/i).first()).toBeVisible({ timeout: 5000 })

    // On reste sur la page de login
    expect(page.url()).toContain('/login')
  })
})
