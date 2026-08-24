import { expect, test } from '@nuxt/test-utils/playwright'

import {
  apiDelete,
  apiPost,
  enableVolunteers,
  getInvitationTokenFromLogs,
  loadState,
  setEditionStatus,
  updateVolunteerSettings,
} from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Le formulaire de candidature bénévole, parcouru par l'interface et non par l'API.
 *
 * `volunteers.spec.ts` couvre déjà le cycle candidature → décision, mais il soumet **par
 * l'API**. Tout ce qui se joue dans le formulaire lui échappait, et c'est là que trois défauts
 * successifs sont passés : un refus de validation qui ne s'affichait nulle part, un bouton
 * d'envoi qui restait grisé après correction, et un 403 sur sa propre candidature. Chacun a été
 * signalé depuis l'application, aucun n'a été attrapé par les tests — qui vérifiaient les
 * pièces en isolation sans jamais parcourir la séquence complète.
 *
 * C'est cette séquence qui est rejouée ici : échec → affichage du refus → correction →
 * renvoi → modification.
 *
 * **Le compte compte.** Le compte de test habituel est organisateur de l'édition, et un
 * organisateur emprunte un tout autre chemin d'autorisation : modifier sa candidature avec lui
 * n'aurait jamais révélé le 403. Un second compte, sans aucun droit, est donc créé pour
 * l'occasion — c'est le seul moyen d'éprouver le cas réel.
 */
test.describe.serial('Formulaire de candidature bénévole (parcours interface)', () => {
  const ts = Date.now()
  const EMAIL = `e2e-benevole-form-${ts}@example.com`
  const MOT_DE_PASSE = 'BenevoleFormPass123!'

  // Huit chiffres : la forme d'un numéro français sans en être un. Accepté avant que la
  // validité réelle ne soit contrôlée, il partait alors avec la candidature — injoignable.
  const TELEPHONE_INVALIDE = '12345678'
  const TELEPHONE_VALIDE = '0612345678'
  const MOTIVATION_MODIFIEE = `Motivation reprise ${ts}`

  let applicationInitiale: number | null = null

  test('ouvrir le recrutement et publier l’édition', async ({ page }) => {
    const { editionId } = loadState()
    await enableVolunteers(page, editionId)
    await updateVolunteerSettings(page, editionId, {
      open: true,
      mode: 'INTERNAL',
      pagePublic: true,
    })
    // Les specs de ce projet partagent une seule édition et se succèdent : plusieurs la
    // remettent hors ligne en nettoyage. Sans republication, un non-organisateur ne verrait
    // rien du tout — le test échouait ainsi selon l'ordre d'exécution.
    await setEditionStatus(page, editionId, 'PUBLISHED')
  })

  test('créer un compte bénévole sans aucun droit sur l’édition', async ({ page }) => {
    const { editionId } = loadState()

    // `create-user-and-add` est le seul chemin qui fabrique un compte utilisable sans passer
    // par l'inscription complète (email de vérification compris). Il crée au passage une
    // candidature acceptée, que l'on supprime aussitôt : on veut un compte vierge, libre de
    // postuler par le formulaire.
    const res = await apiPost(
      page,
      `${BASE}/api/editions/${editionId}/volunteers/create-user-and-add`,
      { data: { email: EMAIL, prenom: 'FormPrenom', nom: 'FormNom' } }
    )
    expect(res.ok(), `create-user-and-add a échoué: ${await res.text()}`).toBe(true)

    const data = (await res.json()).data ?? {}
    applicationInitiale = data.application?.id ?? null
    expect(applicationInitiale).toBeTruthy()

    const suppression = await apiDelete(
      page,
      `${BASE}/api/editions/${editionId}/volunteers/applications/${applicationInitiale}`
    )
    expect(suppression.ok(), `suppression a échoué: ${await suppression.text()}`).toBe(true)
  })

  test('activer le compte par le lien d’invitation', async ({ browser }) => {
    let token = ''
    await expect(async () => {
      token = getInvitationTokenFromLogs()
    }).toPass({ timeout: 10000, intervals: [500] })

    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await context.newPage()
    await page.goto(`${BASE}/auth/invitation?token=${token}`, { waitUntil: 'domcontentloaded' })

    const motsDePasse = page.locator('input[type="password"]')
    await expect(motsDePasse.first()).toBeVisible({ timeout: 10000 })
    await motsDePasse.first().fill(MOT_DE_PASSE)
    if ((await motsDePasse.count()) >= 2) await motsDePasse.nth(1).fill(MOT_DE_PASSE)

    const [reponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/auth/accept-invitation')),
      page.getByRole('button', { name: /activer mon compte/i }).click(),
    ])
    expect(reponse.ok(), `accept-invitation: ${await reponse.text()}`).toBe(true)

    await context.close()
  })

  test('candidater par le formulaire : refus lisible, correction, envoi', async ({ browser }) => {
    const { editionId } = loadState()

    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await context.newPage()

    await connecterBenevole(page, EMAIL, MOT_DE_PASSE)

    await page.goto(`${BASE}/editions/${editionId}/volunteers`, { waitUntil: 'domcontentloaded' })

    await page
      .getByRole('button', { name: /postuler comme bénévole/i })
      .first()
      .click()
    const modale = page.getByRole('dialog')
    await expect(modale).toBeVisible({ timeout: 10000 })

    // Le champ à indicatif de pays : un sélecteur de pays, puis le numéro. C'est lui qui
    // normalise la saisie en E.164 et met fin aux refus sur un numéro collé.
    const numero = modale.locator('input[type="tel"]').first()
    await expect(numero).toBeVisible()
    await numero.fill(TELEPHONE_INVALIDE)

    await choisirDates(modale)

    const envoyer = modale.getByRole('button', { name: /postuler comme bénévole/i }).last()
    await expect(envoyer).toBeEnabled()
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/volunteers/applications') && r.request().method() === 'POST'
      ),
      envoyer.click(),
    ])

    // 1. Le refus doit se lire DANS le formulaire, pas seulement dans un toast fugace.
    await expect(modale.getByText(/numéro de téléphone invalide/i).first()).toBeVisible({
      timeout: 10000,
    })

    // 2. Tant que le refus tient, l'envoi est bloqué.
    await expect(envoyer).toBeDisabled()

    // 3. Corriger doit lever le refus ET réactiver l'envoi — sans quoi on ne peut plus
    //    corriger ce que le serveur vient justement de reprocher.
    await numero.fill(TELEPHONE_VALIDE)
    await expect(modale.getByText(/numéro de téléphone invalide/i)).toHaveCount(0)
    await expect(envoyer).toBeEnabled({ timeout: 10000 })

    const [envoi] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/volunteers/applications') && r.request().method() === 'POST'
      ),
      envoyer.click(),
    ])
    expect(envoi.status(), `candidature refusée: ${await envoi.text()}`).toBe(200)

    await context.close()
  })

  test('modifier sa propre candidature sans être organisateur', async ({ browser }) => {
    const { editionId } = loadState()

    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await context.newPage()

    await connecterBenevole(page, EMAIL, MOT_DE_PASSE)

    await page.goto(`${BASE}/editions/${editionId}/volunteers`, { waitUntil: 'domcontentloaded' })

    await page
      .getByRole('button', { name: /modifier la candidature/i })
      .first()
      .click()
    const modale = page.getByRole('dialog')
    await expect(modale).toBeVisible({ timeout: 10000 })

    // Une valeur reconnaissable : un code 200 ne prouve pas qu'on a enregistré quoi que ce
    // soit. Sans cette vérification, un point d'API qui accepterait tout en silence passerait.
    //
    // Visé par son texte d'invite et non par `getByRole('textbox')` : un `input[type=tel]`
    // porte le même rôle, si bien que le premier « textbox » de la modale est le téléphone.
    const motivation = modale.getByPlaceholder(/ajoutez des commentaires/i)
    await motivation.fill(MOTIVATION_MODIFIEE)

    const enregistrer = modale.getByRole('button', { name: /^enregistrer$/i }).last()
    const [reponse] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/volunteers/applications/') && r.request().method() === 'PATCH'
      ),
      enregistrer.click(),
    ])

    // Le cœur du test : c'est ici que le 403 tombait, d'abord parce que le point d'API
    // n'admettait que les organisateurs, puis parce que le formulaire envoie tout son état —
    // `modificationNote` comprise, vide, que le filtre prenait pour une tentative.
    expect(reponse.status(), `modification refusée: ${await reponse.text()}`).toBe(200)

    const enregistree = await page.request.get(
      `${BASE}/api/editions/${editionId}/volunteers/my-application`
    )
    expect(enregistree.ok()).toBe(true)
    // Enveloppe tolérante : ce point d'API rend la candidature à plat, d'autres la placent
    // sous `data`. Exiger une seule forme rendrait le test faussement rouge.
    const corps = await enregistree.json()
    const candidature = corps.data ?? corps
    expect(candidature.motivation).toBe(MOTIVATION_MODIFIEE)

    await context.close()
  })

  test('nettoyer : refermer le recrutement et remettre l’édition hors ligne', async ({ page }) => {
    const { editionId } = loadState()
    await updateVolunteerSettings(page, editionId, { open: false })
    await setEditionStatus(page, editionId, 'OFFLINE')
  })
})

/**
 * Connecte le bénévole dans son propre contexte.
 *
 * Contexte distinct et non la session partagée du projet : celle-ci appartient à
 * l'organisateur, dont les droits masqueraient précisément ce qu'on veut éprouver.
 */
async function connecterBenevole(
  page: import('@playwright/test').Page,
  email: string,
  motDePasse: string
) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[type="email"]').fill(email)
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/auth/check-email') && r.status() === 200),
    page.getByRole('button', { name: /confirmer/i }).click(),
  ])
  await page.locator('input[type="password"]').first().fill(motDePasse)
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/auth/login') && r.status() === 200),
    page.getByRole('button', { name: /se connecter/i }).click(),
  ])
}

/**
 * Renseigne l'arrivée et le départ, obligatoires dès qu'une disponibilité est cochée —
 * l'événement l'est par défaut. Sans elles le formulaire reste invalide et rien ne part.
 *
 * Les deux listes se repèrent à leur texte d'invite : c'est ce qu'affiche un `USelect` vide,
 * et c'est plus stable qu'une position dans le formulaire, qui varie selon les questions que
 * l'organisateur a activées.
 */
async function choisirDates(modale: import('@playwright/test').Locator) {
  for (const invite of [/sélectionnez votre arrivée/i, /sélectionnez votre départ/i]) {
    const liste = modale.getByRole('combobox').filter({ hasText: invite }).first()
    await liste.click()
    await modale.page().getByRole('option').first().click()
  }
}
