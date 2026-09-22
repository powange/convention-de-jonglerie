import { expect, test } from '@nuxt/test-utils/playwright'

test.describe("Page d'accueil", () => {
  test('affiche les éditions ou un message vide', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })

    // Attendre que du contenu apparaisse (éditions ou message vide)
    await page.waitForSelector('a[href*="/editions/"], :text("aucune convention")', {
      timeout: 10000,
    })

    const editionLinks = page.locator('a[href*="/editions/"]')
    const noResults = page.getByText(/aucune convention/i)

    const hasEditions = (await editionLinks.count()) > 0
    const hasNoResults = await noResults.isVisible().catch(() => false)

    expect(hasEditions || hasNoResults).toBe(true)
  })

  test('affiche les onglets de vue (Grille, Agenda, Carte)', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })

    await expect(page.getByText('Grille')).toBeVisible()
    await expect(page.getByText('Agenda')).toBeVisible()
    await expect(page.getByText('Carte')).toBeVisible()
  })

  test('peut changer de mode de vue', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })

    // Cliquer sur Agenda
    await page.getByText('Agenda').click()
    await expect(page).toHaveURL(/view=agenda/)

    // Cliquer sur Carte
    await page.getByText('Carte').click()
    await expect(page).toHaveURL(/view=map/)

    // Revenir en Grille
    await page.getByText('Grille').click()
    await expect(page).not.toHaveURL(/view=/)
  })
  /**
   * L'agenda s'ouvre sur le MOIS COURANT, même après avoir parcouru un autre mois.
   *
   * Signalé en production le 22/09/2025 : il proposait juin 2026 alors qu'on était en septembre.
   * La mémoire du mois consulté vivait dans `localStorage`, donc sans fin — un mois parcouru une
   * fois s'y installait pour toujours, et plus personne ne voyait les conventions du moment.
   *
   * ⚠️ Le test SÈME la mémoire d'époque avant de charger la page. Sans cela il ne prouverait
   * rien : un contexte de test neuf a un stockage vide, et le code fautif y ouvrait aussi sur
   * aujourd'hui. C'est bien la présence d'une valeur ancienne qui déclenchait le défaut.
   *
   * Garder sa place le temps d'une visite reste voulu — c'est `sessionStorage` qui s'en charge
   * désormais, et ce n'est pas ce qui se vérifie ici.
   */
  test('l’agenda s’ouvre sur le mois courant malgré une mémoire ancienne', async ({
    page,
    goto,
  }) => {
    await goto('/', { waitUntil: 'hydration' })
    await page.evaluate(() =>
      localStorage.setItem('calendar-current-date', '2026-06-15T00:00:00.000Z')
    )

    await goto('/?view=agenda', { waitUntil: 'hydration' })

    // Le titre que FullCalendar écrit en français : « septembre 2026 ». Calculé plutôt qu'écrit
    // en dur, sans quoi le test deviendrait faux le mois suivant.
    const moisCourant = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

    await expect(page.locator('.fc-toolbar-title').first()).toHaveText(
      new RegExp(moisCourant, 'i'),
      { timeout: 15000 }
    )

    // Et la mémoire d'époque est balayée, plutôt que de rester dans le navigateur à jamais.
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('calendar-current-date')))
      .toBeNull()
  })
})

test.describe('Navigation', () => {
  test('le header et le footer sont visibles', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })

    await expect(page.locator('header')).toBeVisible()
    await expect(page.locator('footer')).toBeVisible()
  })

  test('la page de connexion est accessible', async ({ page, goto }) => {
    await goto('/login', { waitUntil: 'hydration' })

    // Le formulaire de connexion doit contenir un champ email
    await expect(page.locator('input[type="email"], input[placeholder*="email" i]')).toBeVisible()
  })
})
