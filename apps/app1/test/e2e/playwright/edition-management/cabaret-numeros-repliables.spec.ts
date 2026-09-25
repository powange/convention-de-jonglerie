import { expect, test } from '@nuxt/test-utils/playwright'

import { createShow, deleteShow, loadState, updateEdition } from '../helpers'

const BASE = 'http://localhost:3000'

/** Assez long pour dépasser la largeur d'un téléphone, et vérifier qu'il n'est pas tronqué. */
const TITRE_LONG =
  'Duo de massues et de diabolos avec passages croisés, portés acrobatiques et final au sol'
const TITRE_COURT = 'Solo de monocycle'
/** Le nom de scène du premier numéro. Le second n'en a pas : les deux cas doivent se voir. */
const COMPAGNIE = 'Cie des Trois Massues'

/**
 * Les numéros d'un cabaret se replient.
 *
 * Le défaut venait de l'usage sur téléphone : chaque numéro déployait ses six champs, une carte
 * occupait plusieurs écrans de haut, et réordonner devenait pénible — les flèches du numéro suivant
 * se trouvaient très loin. Replié, un numéro n'affiche que son rang, son titre et ses artistes.
 *
 * Ces tests portent surtout sur ce qui s'est cassé en chemin : un titre tronqué, et une suppression
 * sans confirmation.
 */
test.describe.serial('Numéros d’un cabaret — repli', () => {
  let cabaretId = ''

  const ouvrir = async (
    page: import('@playwright/test').Page,
    goto: (u: string, o?: object) => Promise<unknown>
  ) => {
    const { editionId } = loadState()
    await goto(`/editions/${editionId}/gestion/artists/shows/${cabaretId}/numeros`, {
      waitUntil: 'hydration',
    })
    await expect(page.getByText(TITRE_LONG)).toBeVisible({ timeout: 40000 })
  }

  const carteDe = (page: import('@playwright/test').Page, titre: string) =>
    page.locator('div').filter({ hasText: titre }).locator('..').first()

  test('préparer un cabaret à deux numéros', async ({ page }) => {
    const { editionId } = loadState()
    await updateEdition(page, editionId, { artistsEnabled: true })

    const cabaret = await createShow(page, editionId, {
      title: `Cabaret repli ${Date.now()}`,
      type: 'CABARET',
      startDateTime: new Date().toISOString(),
      duration: 90,
      acts: [
        { title: TITRE_LONG, companyName: COMPAGNIE, duration: 10 },
        { title: TITRE_COURT, duration: 15 },
      ],
    })
    expect(cabaret.type).toBe('CABARET')
    cabaretId = String(cabaret.id)
  })

  test('les numéros sont repliés à l’ouverture', async ({ page, goto }) => {
    await ouvrir(page, goto)

    // Les titres — donc les en-têtes — sont là.
    await expect(page.getByText(TITRE_LONG)).toBeVisible()
    await expect(page.getByText(TITRE_COURT)).toBeVisible()

    /*
     * Les champs du corps, non.
     *
     * ⚠️ Sur la VISIBILITÉ, jamais sur le nombre de nœuds : le corps est masqué par `v-show`, donc
     * bien présent dans le DOM. Un `toHaveCount(0)` échoue ici pour la bonne raison — et un test
     * écrit ainsi passerait pour un `v-if`, cachant que le repli a perdu l'état du menu de
     * sélection des artistes au passage.
     */
    await expect(page.getByText('Besoins techniques').first()).toBeHidden()
    await expect(page.getByText('Besoins techniques').nth(1)).toBeHidden()
  })

  test('replié, le nom de scène se lit sous le titre', async ({ page, goto }) => {
    await ouvrir(page, goto)

    /*
     * Le titre d'un numéro ne dit pas qui le joue.
     *
     * Replié, un numéro se reconnaît à trois choses : son rang, son titre, et le nom sous lequel
     * ses artistes se présentent. Ce dernier vient de la candidature, reprise à l'import — il
     * n'existait nulle part dans la gestion avant.
     */
    await expect(page.getByText(COMPAGNIE)).toBeVisible()

    // Déplié, il n'est plus répété en tête : il est dans son champ, sous le titre du formulaire.
    await page.getByText(TITRE_LONG).first().click()
    await expect(page.getByText('Besoins techniques').first()).toBeVisible()
    // Il ne reste que l'occurrence du champ, pas celle de l'en-tête.
    await expect(page.getByText(COMPAGNIE, { exact: true })).toHaveCount(0)
    await expect(page.locator(`input[value="${COMPAGNIE}"]`)).toHaveCount(1)
  })

  test('le titre n’est jamais tronqué : il passe à la ligne', async ({ page, goto }) => {
    await ouvrir(page, goto)

    /*
     * Le titre partageait d'abord la largeur avec le rang et les trois boutons d'action, et se
     * faisait couper d'un « … » — soit précisément ce qu'on cherche à lire sans déplier. Il occupe
     * désormais sa propre ligne.
     *
     * La mesure porte sur le débordement réel (`scrollWidth` contre `clientWidth`) et sur la
     * hauteur : un `truncate` tient le texte sur une seule ligne, l'écrêtant ; wrappé, il en occupe
     * plusieurs. Vérifier l'absence de la classe ne prouverait rien — une autre règle pourrait la
     * réintroduire.
     */
    const titre = page.getByText(TITRE_LONG).first()
    const mesure = await titre.evaluate((el) => {
      const s = getComputedStyle(el)
      return {
        debordement: el.scrollWidth - el.clientWidth,
        hauteur: el.getBoundingClientRect().height,
        ligne: parseFloat(s.lineHeight) || 24,
        espaces: s.whiteSpace,
        overflow: s.textOverflow,
      }
    })

    expect(mesure.debordement, 'le titre déborde de sa boîte').toBeLessThanOrEqual(1)
    expect(mesure.espaces, 'le titre doit pouvoir passer à la ligne').not.toBe('nowrap')
    expect(mesure.overflow).not.toBe('ellipsis')
    // Sur un écran de test large, ce titre tient sur une ligne : on vérifie donc seulement qu'il
    // n'est pas écrêté. Le passage à la ligne, lui, se mesure à largeur de téléphone ci-dessous.
    expect(mesure.hauteur).toBeGreaterThan(0)
  })

  test('à largeur de téléphone, le titre occupe plusieurs lignes', async ({ browser }) => {
    const { editionId } = loadState()
    const AUTH = new URL('../../../../test-results/.auth/user.json', import.meta.url).pathname
    const context = await browser.newContext({
      storageState: AUTH,
      viewport: { width: 390, height: 844 },
      locale: 'fr-FR',
    })
    const page = await context.newPage()
    await page.goto(`${BASE}/editions/${editionId}/gestion/artists/shows/${cabaretId}/numeros`, {
      waitUntil: 'domcontentloaded',
    })
    const titre = page.getByText(TITRE_LONG).first()
    await expect(titre).toBeVisible({ timeout: 40000 })

    const m = await titre.evaluate((el) => {
      const s = getComputedStyle(el)
      return {
        hauteur: el.getBoundingClientRect().height,
        ligne: parseFloat(s.lineHeight) || 24,
        debordement: el.scrollWidth - el.clientWidth,
      }
    })
    // C'est ici que le défaut se voyait : une seule ligne, coupée. Plusieurs lignes le réfutent.
    expect(m.hauteur).toBeGreaterThan(m.ligne * 1.5)
    expect(m.debordement).toBeLessThanOrEqual(1)

    await context.close()
  })

  test('le titre déplie le numéro, et lui seul', async ({ page, goto }) => {
    await ouvrir(page, goto)

    await page.getByText(TITRE_LONG).first().click()

    // Le corps du premier numéro s'ouvre…
    await expect(page.getByText('Besoins techniques').first()).toBeVisible()
    // …et le second reste replié. C'est ce que « lui seul » veut dire : l'état est attaché au
    // numéro, pas partagé par l'éditeur.
    await expect(page.getByText('Besoins techniques').nth(1)).toBeHidden()
  })

  test('un numéro qu’on ajoute s’ouvre de lui-même', async ({ page, goto }) => {
    await ouvrir(page, goto)

    // On ajoute un numéro pour le remplir, et il n'a pas encore de titre à lire replié : le laisser
    // fermé imposerait un geste de plus sur une carte vide.
    await page.getByRole('button', { name: /ajouter un numéro/i }).click()

    const champs = page.getByText('Besoins techniques')
    await expect(champs).toHaveCount(3)
    // Le troisième est le nouveau : ouvert, tandis que les deux premiers restent repliés.
    await expect(champs.nth(2)).toBeVisible()
    await expect(champs.nth(0)).toBeHidden()
    await expect(champs.nth(1)).toBeHidden()
  })

  test('supprimer un numéro demande confirmation', async ({ page, goto }) => {
    await ouvrir(page, goto)

    const avant = await page.getByRole('button', { name: /supprimer le numéro/i }).count()
    expect(avant).toBe(2)

    await page
      .getByRole('button', { name: /supprimer le numéro/i })
      .first()
      .click()

    // Rien n'est retiré avant la réponse : c'est tout l'objet de la modale.
    //
    // `.first()` parce que le titre apparaît DEUX fois une fois la modale ouverte — dans l'en-tête
    // du numéro et dans la description. Ce doublon est précisément ce que la modale doit faire :
    // dire sur quoi porte l'action.
    await expect(page.getByText(TITRE_LONG).first()).toBeVisible()
    const modale = page.getByRole('dialog')
    await expect(modale).toBeVisible({ timeout: 10000 })
    // Le libellé nomme le numéro, et dit que le retrait attend l'enregistrement.
    await expect(modale).toContainText(TITRE_LONG)
    await expect(modale).toContainText(/enregistrement/i)

    // Renoncer ne retire rien.
    await page.keyboard.press('Escape')
    await expect(modale).toBeHidden()
    await expect(page.getByRole('button', { name: /supprimer le numéro/i })).toHaveCount(2)

    // Confirmer, si.
    await page
      .getByRole('button', { name: /supprimer le numéro/i })
      .first()
      .click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /supprimer/i })
      .click()
    await expect(page.getByText(TITRE_LONG)).toHaveCount(0)
    await expect(page.getByText(TITRE_COURT)).toBeVisible()
  })

  test('nettoyage : supprimer le cabaret', async ({ page }) => {
    const { editionId } = loadState()
    if (cabaretId) await deleteShow(page, editionId, cabaretId)
    await updateEdition(page, editionId, { artistsEnabled: false })
  })
})
