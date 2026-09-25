import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPost, createShow, loadState, updateEdition } from '../helpers'

const BASE = 'http://localhost:3000'
const MESSAGE = `Répétition générale à 18 h — message de test ${Date.now()}`

/**
 * La page des notifications aux artistes : ouvrir le détail d'un envoi, et rafraîchir les lectures.
 *
 * Deux gestes y étaient malcommodes. Le détail d'une notification ne s'ouvrait que par une icône de
 * quelques millimètres, à droite de la carte. Et la liste des personnes notifiées ne se chargeait
 * qu'à l'OUVERTURE de la modale : en attendant qu'un artiste confirme sa lecture, il fallait la
 * refermer et la rouvrir pour savoir où l'on en était.
 *
 * ⚠️ Édition DÉDIÉE. Ce spec crée une édition, un spectacle, un artiste et une notification ; sur
 * l'édition du harnais, ces traces déborderaient sur les autres specs du même lot.
 */
test.describe.serial('Notifications aux artistes — carte et rafraîchissement', () => {
  let editionId = ''

  test('préparer une édition avec un artiste et une notification envoyée', async ({ page }) => {
    const { conventionId } = loadState()

    const edition = await apiPost(page, `${BASE}/api/editions`, {
      data: {
        conventionId: Number(conventionId),
        startDate: new Date(Date.now() + 86400000).toISOString(),
        endDate: new Date(Date.now() + 3 * 86400000).toISOString(),
        addressLine1: '1 rue des Notifications',
        postalCode: '75001',
        city: 'Paris',
        country: 'France',
      },
    })
    expect(edition.ok(), `création d'édition : ${await edition.text()}`).toBe(true)
    editionId = String((await edition.json()).data?.id)

    await updateEdition(page, editionId, { artistsEnabled: true })

    // Un spectacle, pour que la page ait de quoi cibler — et un artiste, sans quoi le panneau
    // affiche « aucun artiste » au lieu du formulaire.
    await createShow(page, editionId, {
      title: `Spectacle notifications ${Date.now()}`,
      startDateTime: new Date(Date.now() + 86400000).toISOString(),
      duration: 45,
    })

    const artiste = await apiPost(page, `${BASE}/api/editions/${editionId}/artists`, {
      data: { email: `e2e-notif-${Date.now()}@example.com`, prenom: 'Notif', nom: 'Artiste' },
    })
    expect(artiste.ok(), `création d'artiste : ${await artiste.text()}`).toBe(true)

    const envoi = await apiPost(page, `${BASE}/api/editions/${editionId}/artists/notifications`, {
      data: { targetType: 'all', message: MESSAGE },
    })
    expect(envoi.ok(), `envoi de la notification : ${await envoi.text()}`).toBe(true)
  })

  test('toute la carte ouvre le détail, et elle est atteignable au clavier', async ({
    page,
    goto,
  }) => {
    await goto(`/editions/${editionId}/gestion/artists/notifications`, { waitUntil: 'hydration' })
    await expect(page.getByText(MESSAGE)).toBeVisible({ timeout: 40000 })

    /*
     * La carte est un `button`, et non un `div` cliquable.
     *
     * C'est la différence qui compte : un `div` porteur d'un `@click` s'ouvre à la souris mais reste
     * hors d'atteinte au clavier, et rien ne l'annonce comme ouvrant quelque chose. Vérifier
     * seulement que le clic fonctionne laisserait passer cette version-là.
     */
    const carte = page.locator('button').filter({ hasText: MESSAGE }).first()
    await expect(carte).toBeVisible()

    // L'icône en forme d'œil a été retirée : la carte entière portant le clic, elle ne désignait
    // plus rien.
    await expect(carte.locator('[class*="i-heroicons-eye"]')).toHaveCount(0)

    // Le clic ouvre bien la modale, sur n'importe quel point de la carte.
    await carte.click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 })
  })

  test('la modale porte un bouton qui recharge la liste sur place', async ({ page, goto }) => {
    await goto(`/editions/${editionId}/gestion/artists/notifications`, { waitUntil: 'hydration' })
    await expect(page.getByText(MESSAGE)).toBeVisible({ timeout: 40000 })
    await page.locator('button').filter({ hasText: MESSAGE }).first().click()

    const modale = page.getByRole('dialog')
    await expect(modale).toBeVisible({ timeout: 10000 })

    const rafraichir = modale.getByRole('button', { name: /rafraîchir/i })
    await expect(rafraichir, 'le bouton de rafraîchissement, en haut de la modale').toBeVisible()

    /*
     * Le rechargement se prouve par l'APPEL, pas par l'apparence.
     *
     * Rien ne change à l'écran quand personne n'a confirmé entre-temps : un test qui n'observerait
     * que le rendu serait vert même si le bouton ne faisait rien. On compte donc la requête.
     */
    const appels: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/confirmations')) appels.push(r.url())
    })

    await rafraichir.click()
    await expect.poll(() => appels.length, { timeout: 10000 }).toBeGreaterThan(0)

    // La modale reste ouverte : rafraîchir ne doit pas faire perdre sa place au lecteur.
    await expect(modale).toBeVisible()
  })

  test('nettoyage : supprimer l’édition dédiée', async ({ page }) => {
    if (editionId) {
      const suppression = await apiDelete(page, `${BASE}/api/editions/${editionId}`)
      expect(suppression.ok(), await suppression.text()).toBe(true)
    }
  })
})
