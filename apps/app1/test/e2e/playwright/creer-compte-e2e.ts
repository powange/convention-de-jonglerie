import fs from 'node:fs'
import path from 'node:path'

import { expect } from '@nuxt/test-utils/playwright'

import type { Page } from '@playwright/test'

import { getVerificationCodeFromLogs } from './helpers'

/**
 * Crée un compte E2E par le PARCOURS RÉEL, et enregistre sa session — constat CI·4.
 *
 * ## ⚠️⚠️ POURQUOI CE FICHIER EXISTE : DEUX SPECS SE CORROMPAIENT
 *
 * Tous les tests du projet `authenticated` partageaient UN SEUL compte, et deux d'entre eux
 * écrivent le profil : `profile.spec.ts` (allergies, contact d'urgence) et
 * `langue-du-profil.spec.ts` (langue). Or `PUT /api/profile/update` a une sémantique de
 * REMPLACEMENT — il exige un profil complet et écrase ce qu'on ne lui envoie pas.
 *
 * En parallèle, la seconde écriture effaçait donc les champs de la première : une mise à jour
 * perdue, et un test qui échoue sur une valeur qu'il a bien envoyée. La protection était un
 * `workers: 1` sur tout le projet.
 *
 * 📍 ET LIRE LE PROFIL AVANT D'ÉCRIRE NE SUFFIT PAS. C'est ce que fait déjà la spec de la langue,
 * et deux lectures-modifications-écritures entrelacées perdent toujours l'une des deux. Seuls
 * DEUX COMPTES rendent ces specs réellement indépendantes.
 *
 * ## 📍 Ce que cette extraction NE gagne PAS
 *
 * Du temps de CI. Mesuré le 12/10 : le projet `authenticated` tourne dans le lot `publics`, à
 * **105 s** — le lot le plus court —, et le chemin critique de la CI est le job des tests Nuxt, à
 * **7 min 56**. Le gain en horloge est nul, et la création d'un second compte coûte même quelques
 * dizaines de secondes à ce lot-là. Ce qu'elle gagne est la disparition d'un piège : le
 * `workers: 1` global est tombé au constat CI·5, et sans deux comptes, retirer celui du projet
 * corromprait les données en silence.
 */
export async function creerUnCompteE2E(
  page: Page,
  goto: (url: string, options?: { waitUntil?: string }) => Promise<unknown>,
  identite: { email: string; motDePasse: string; pseudo: string },
  sorties: { sessionFile: string; credentialsFile?: string }
) {
  const { email, motDePasse, pseudo } = identite

  // Étape 1 : Page de login → saisir l'email
  await goto('/login', { waitUntil: 'hydration' })
  await page.locator('input[type="email"], input[placeholder*="email" i]').fill(email)

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
    .fill(pseudo)

  // Remplir le mot de passe
  await page.locator('input[type="password"]').first().fill(motDePasse)

  // Confirmer le mot de passe si le champ existe
  const passwordInputs = page.locator('input[type="password"]')
  if ((await passwordInputs.count()) >= 2) {
    await passwordInputs.nth(1).fill(motDePasse)
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
  await page.context().storageState({ path: sorties.sessionFile })

  // Les identifiants ne servent qu'au compte principal — `login.spec.ts` s'y reconnecte.
  if (sorties.credentialsFile) {
    fs.mkdirSync(path.dirname(sorties.credentialsFile), { recursive: true })
    fs.writeFileSync(
      sorties.credentialsFile,
      JSON.stringify({ email, password: motDePasse, pseudo })
    )
  }
}
