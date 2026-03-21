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
  test('affiche une page 404 pour une URL inexistante', async ({ page, goto }) => {
    await goto('/cette-page-nexiste-pas', { waitUntil: 'hydration' })

    // La page doit afficher un message d'erreur 404
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible()
  })
})
