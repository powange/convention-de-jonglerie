import { expect, test } from '@nuxt/test-utils/playwright'

test.describe('Profil (connecté)', () => {
  test('la page profil est accessible', async ({ page, goto }) => {
    await goto('/profile', { waitUntil: 'hydration' })

    // On ne doit PAS être redirigé vers /login
    expect(page.url()).not.toContain('/login')

    // La page doit afficher le nom de l'utilisateur ou le formulaire de profil
    await expect(page.locator('h1')).toBeVisible()
  })

  test('la page favoris est accessible', async ({ page, goto }) => {
    await goto('/favorites', { waitUntil: 'hydration' })

    expect(page.url()).not.toContain('/login')
    await expect(page.getByText(/favoris/i).first()).toBeVisible()
  })

  test('la page mes conventions est accessible', async ({ page, goto }) => {
    await goto('/profile/mes-conventions', { waitUntil: 'hydration' })

    expect(page.url()).not.toContain('/login')
  })
})

/**
 * Santé et contact d'urgence sur le profil.
 *
 * Ce bloc existe pour une raison précise : la liste de gravité portait une option de valeur
 * vide, que Nuxt UI refuse — la chaîne vide lui sert à signifier « aucune sélection ». Rien ne
 * le signalait avant l'ouverture réelle de la liste : ni le lint, ni le typecheck, ni un test
 * qui se contente de charger la page. L'erreur ne surgit qu'au rendu des options.
 *
 * D'où un parcours qui ouvre vraiment le sélecteur, enregistre, et relit après rechargement.
 */
test.describe.serial("Profil — santé et contact d'urgence", () => {
  // Le projet `authenticated` laisse 30 s par test, ce qui suffit à ouvrir une page et à
  // regarder. Ici on remplit une demi-douzaine de champs, on ouvre deux listes déroulantes et
  // on attend un aller-retour serveur ; en développement, la première compilation de la page
  // consomme à elle seule une bonne part du budget. Sans cette rallonge, le test échouait sur
  // le temps imparti — un faux négatif que j'ai d'abord pris pour un défaut du formulaire.
  test.describe.configure({ timeout: 120000 })

  const ALLERGIE = 'Arachides et fruits à coque'

  test('renseigner régime, allergie et gravité, puis enregistrer', async ({ page, goto }) => {
    // Toute erreur de rendu Vue est fatale ici : c'est précisément ce qu'on traque.
    const erreurs: string[] = []
    page.on('pageerror', (e) => erreurs.push(e.message))

    await goto('/profile/informations', { waitUntil: 'hydration' })

    const regime = page
      .getByRole('combobox')
      .filter({ hasText: /régime|aucun régime/i })
      .first()
    await expect(regime).toBeVisible({ timeout: 15000 })
    await regime.click()
    await page.getByRole('option', { name: /végétarien/i }).click()

    const allergies = page.getByPlaceholder(/arachides, gluten, lactose/i)
    await expect(allergies).toBeVisible()
    await allergies.fill(ALLERGIE)

    // La gravité n'apparaît qu'une fois une allergie décrite.
    const gravite = page
      .getByRole('combobox')
      .filter({ hasText: /non précisée/i })
      .first()
    await expect(gravite).toBeVisible({ timeout: 5000 })

    // L'ouvrir : c'est le rendu des options qui faisait éclater le composant.
    await gravite.click()
    await page.getByRole('option', { name: /modér/i }).click()

    await page.getByPlaceholder(/prénom et nom/i).fill('Camille Dupont')

    const [reponse] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/profile/update') && r.request().method() === 'PUT'
      ),
      page
        .getByRole('button', { name: /sauvegarder les modifications/i })
        .first()
        .click(),
    ])
    expect(reponse.status(), `enregistrement refusé: ${await reponse.text()}`).toBe(200)

    expect(erreurs, `erreurs de rendu: ${erreurs.join(' | ')}`).toEqual([])
  })

  test('les valeurs sont relues après rechargement', async ({ page, goto }) => {
    await goto('/profile/informations', { waitUntil: 'hydration' })

    // Relire depuis l'écran, et non depuis l'API : c'est le pré-remplissage qu'on vérifie,
    // et il dépend de ce que la session expose.
    await expect(page.getByPlaceholder(/arachides, gluten, lactose/i)).toHaveValue(ALLERGIE, {
      timeout: 15000,
    })
    await expect(
      page
        .getByRole('combobox')
        .filter({ hasText: /végétarien/i })
        .first()
    ).toBeVisible()
    await expect(page.getByPlaceholder(/prénom et nom/i)).toHaveValue('Camille Dupont')
  })
})
