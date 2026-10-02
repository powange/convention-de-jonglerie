import { expect, test } from '@nuxt/test-utils/playwright'

test.describe('Pages publiques', () => {
  test('la page guide est accessible', async ({ page, goto }) => {
    await goto('/guide', { waitUntil: 'hydration' })

    // La page doit contenir du contenu
    await expect(page.locator('main')).toBeVisible()
  })

  test('la politique de confidentialité est accessible', async ({ page, goto }) => {
    await goto('/privacy-policy', { waitUntil: 'hydration' })

    await expect(page.locator('main')).toBeVisible()
  })

  test('le footer contient les liens importants', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })

    const footer = page.locator('footer')
    await expect(footer).toBeVisible()

    // Liens du footer
    await expect(footer.getByText(/confidentialité|privacy/i)).toBeVisible()
    await expect(footer.getByText(/guide/i)).toBeVisible()
  })
})

test.describe('Page 404', () => {
  /**
   * ⚠️ CETTE SPEC ATTENDAIT UN TITRE « 404 » — celui de la page d'erreur par défaut de Nuxt, que
   * le site n'a plus. Elle décrivait donc l'absence de page d'erreur, pas un choix.
   *
   * Ce qu'elle garde maintenant : qu'une adresse inconnue s'annonce en toutes lettres, qu'elle
   * porte toujours son code, et qu'elle ne propose PAS de réessayer — un rechargement ne mènerait
   * qu'au même 404. Le bouton de reprise, lui, n'existe que pour un chargement interrompu.
   *
   * 📍 C'est la seule épreuve de la page d'erreur dans une application CONSTRUITE : les tests de
   * composant la montent, ils ne disent rien du rendu réel ni de la locale retenue (ici fr-FR,
   * fixée par la configuration Playwright).
   */
  test('annonce une adresse introuvable, sans proposer de réessayer', async ({ page, goto }) => {
    await goto('/cette-page-nexiste-pas', { waitUntil: 'hydration' })

    await expect(page.getByRole('heading', { name: /introuvable/i })).toBeVisible()
    await expect(page.getByText('404', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /réessayer/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /accueil/i })).toBeVisible()
  })
})
