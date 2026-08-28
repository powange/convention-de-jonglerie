import { expect, test } from '@nuxt/test-utils/playwright'

import {
  apiPost,
  apiPut,
  enableVolunteers,
  getInvitationTokenFromLogs,
  loadState,
  setEditionStatus,
  updateEdition,
} from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Un bénévole affecté à un créneau d'une équipe habilitée au contrôle d'accès doit pouvoir
 * atteindre la page de contrôle d'accès pendant son service, sans avoir aucun droit de gestion.
 *
 * Le défaut d'origine se voyait mal : la permission était calculée côté serveur, mais aucune
 * carte, aucune entrée de menu n'y menait, et la page d'accueil de la gestion refusait l'entrée.
 * D'où ce parcours de bout en bout, du compte créé jusqu'à la page atteinte.
 */
test.describe.serial('Bénévole en créneau de contrôle d’accès', () => {
  const ts = Date.now()
  const EMAIL = `e2e-controle-acces-${ts}@example.com`
  const PASSWORD = 'ControleAccesPass123!'

  let editionId = ''
  let equipeId = ''
  let creneauId = ''
  let benevoleId = 0
  let jeton = ''

  test('préparer l’édition, une équipe habilitée et un créneau en cours', async ({ page }) => {
    // Édition dédiée, encadrant l'instant présent : un créneau doit tomber dans la période de
    // son édition, et celle du harnais partagé se tient dans une semaine. La déplacer
    // dérangerait les autres tests qui s'appuient dessus.
    const { conventionId } = loadState()
    const debut = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const fin = new Date(Date.now() + 24 * 60 * 60 * 1000)

    const edition = await apiPost(page, `${BASE}/api/editions`, {
      data: {
        conventionId: Number(conventionId),
        startDate: debut.toISOString(),
        endDate: fin.toISOString(),
        addressLine1: '1 rue du Contrôle',
        postalCode: '75001',
        city: 'Paris',
        country: 'France',
      },
    })
    expect(edition.ok(), `création d'édition : ${await edition.text()}`).toBe(true)
    const corpsEdition = await edition.json()
    editionId = String(corpsEdition.data?.id ?? corpsEdition.id)

    // Publiée, sans quoi le bénévole — qui n'est pas organisateur — ne peut pas même la charger
    // et voit « Édition introuvable » à la place de la gestion.
    await setEditionStatus(page, editionId, 'PUBLISHED')
    await enableVolunteers(page, editionId)
    await updateEdition(page, editionId, { ticketingEnabled: true })

    const equipe = await apiPost(page, `${BASE}/api/editions/${editionId}/volunteer-teams`, {
      data: { name: `Accueil ${ts}`, color: '#3b82f6', isAccessControlTeam: true },
    })
    expect(equipe.ok(), `création d'équipe : ${await equipe.text()}`).toBe(true)
    const corpsEquipe = await equipe.json()
    equipeId = corpsEquipe.data?.id ?? corpsEquipe.id
    expect(equipeId, `identifiant d'équipe absent : ${JSON.stringify(corpsEquipe)}`).toBeTruthy()

    // Un créneau qui encadre l'instant présent : le test ne dépend pas de l'heure qu'il est.
    const maintenant = Date.now()
    const creneau = await apiPost(page, `${BASE}/api/editions/${editionId}/volunteer-time-slots`, {
      data: {
        title: 'Contrôle des billets',
        teamId: equipeId,
        startDateTime: new Date(maintenant - 30 * 60 * 1000).toISOString(),
        endDateTime: new Date(maintenant + 30 * 60 * 1000).toISOString(),
        maxVolunteers: 3,
      },
    })
    expect(creneau.ok(), `création de créneau : ${await creneau.text()}`).toBe(true)
    // L'endpoint peut créer plusieurs créneaux d'un coup (récurrence) : il renvoie une liste.
    const corps = await creneau.json()
    creneauId = (corps.data?.timeSlots ?? corps.timeSlots ?? [])[0]?.id
    expect(creneauId, `identifiant de créneau absent : ${JSON.stringify(corps)}`).toBeTruthy()
  })

  test('créer un bénévole accepté et l’affecter au créneau', async ({ page }) => {
    const creation = await apiPost(
      page,
      `${BASE}/api/editions/${editionId}/volunteers/create-user-and-add`,
      { data: { email: EMAIL, prenom: 'Benevole', nom: 'ControleAcces' } }
    )
    expect(creation.ok(), `create-user-and-add : ${await creation.text()}`).toBe(true)
    const data = (await creation.json()).data ?? (await creation.json())
    benevoleId = data.user.id

    await expect(async () => {
      jeton = getInvitationTokenFromLogs()
    }).toPass({ timeout: 10000, intervals: [500] })

    const affectation = await apiPost(
      page,
      `${BASE}/api/editions/${editionId}/volunteer-time-slots/${creneauId}/assignments`,
      { data: { userId: benevoleId } }
    )
    expect(affectation.ok(), `affectation : ${await affectation.text()}`).toBe(true)
  })

  test('le bénévole active son compte', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await context.newPage()

    await page.goto(`${BASE}/auth/invitation?token=${jeton}`, { waitUntil: 'domcontentloaded' })
    const motsDePasse = page.locator('input[type="password"]')
    await expect(motsDePasse.first()).toBeVisible({ timeout: 10000 })
    await motsDePasse.first().fill(PASSWORD)
    if ((await motsDePasse.count()) >= 2) await motsDePasse.nth(1).fill(PASSWORD)
    await page.getByRole('button', { name: /activer mon compte/i }).click()
    await expect(page.getByText(/compte activé/i).first()).toBeVisible({ timeout: 10000 })

    await context.close()
  })

  test('l’accueil de la gestion l’emmène droit au contrôle d’accès', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await context.newPage()

    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await page.fill('input[type="email"]', EMAIL)
    await page.getByRole('button', { name: /confirmer/i }).click()
    await page.waitForSelector('input[type="password"]')
    await page.fill('input[type="password"]', PASSWORD)
    await page
      .getByRole('button', { name: /se connecter|connexion|valider/i })
      .first()
      .click()
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 })

    await page.goto(`${BASE}/editions/${editionId}/gestion`, { waitUntil: 'domcontentloaded' })

    // Une seule destination lui est offerte : la page d'accueil doit y mener directement.
    await expect(page).toHaveURL(
      new RegExp(`/editions/${editionId}/gestion/ticketing/access-control$`),
      { timeout: 30000 }
    )
    await expect(page.getByText(/Accès refusé/i)).toHaveCount(0)

    await context.close()
  })

  test('hors créneau, l’accès se referme', async ({ page, browser }) => {
    // Le créneau est repoussé dans le passé, bien au-delà de la tolérance de quinze minutes.
    const maintenant = Date.now()
    // `apiPut` plutôt que `page.request.put` : c'est lui qui porte le jeton CSRF, sans quoi la
    // requête est rejetée en 403 — ce qui n'a rien à voir avec les droits.
    const maj = await apiPut(
      page,
      `${BASE}/api/editions/${editionId}/volunteer-time-slots/${creneauId}`,
      {
        data: {
          startDateTime: new Date(maintenant - 4 * 60 * 60 * 1000).toISOString(),
          endDateTime: new Date(maintenant - 3 * 60 * 60 * 1000).toISOString(),
        },
      }
    )
    expect(maj.ok(), `report du créneau : ${await maj.text()}`).toBe(true)

    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const benevole = await context.newPage()
    await benevole.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await benevole.fill('input[type="email"]', EMAIL)
    await benevole.getByRole('button', { name: /confirmer/i }).click()
    await benevole.waitForSelector('input[type="password"]')
    await benevole.fill('input[type="password"]', PASSWORD)
    await benevole
      .getByRole('button', { name: /se connecter|connexion|valider/i })
      .first()
      .click()
    await benevole.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 })

    await benevole.goto(`${BASE}/editions/${editionId}/gestion`, { waitUntil: 'domcontentloaded' })
    await expect(benevole.getByText(/Accès refusé/i).first()).toBeVisible({ timeout: 30000 })

    await context.close()
  })
})
