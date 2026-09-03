import { expect, test, type Locator, type Page } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPost, loadState } from '../helpers'

const BASE = 'http://localhost:3000'
const AUTH = new URL('../../../../test-results/.auth/user.json', import.meta.url).pathname

/**
 * Dans les formulaires d'ajout de la carte du site, les listes déroulantes s'ouvraient DERRIÈRE
 * la modale : le menu existait et était « visible » au sens CSS, mais l'overlay du dialogue —
 * monté à `z-50` pour passer devant le panneau de la carte — le recouvrait. Vu de l'utilisateur,
 * le select refusait de s'ouvrir.
 *
 * D'où la mesure retenue ici : ce n'est pas `toBeVisible()` qui tranche — il passait alors même
 * que le défaut était là — mais ce que renvoie `elementFromPoint` à l'emplacement du menu. Si un
 * autre élément répond, c'est lui que l'utilisateur touche.
 */
test.describe('Carte du site — les menus des selects passent devant la modale', () => {
  // Le select « zone de rattachement » n'apparaît que si l'édition possède au moins une zone.
  // On en crée donc une, sans quoi la moitié du défaut signalé resterait hors du test.
  let zoneId = ''

  test.beforeAll(async ({ browser }) => {
    const { editionId } = loadState()
    const context = await browser.newContext({ storageState: AUTH })
    const page = await context.newPage()
    const r = await apiPost(page, `${BASE}/api/editions/${editionId}/zones`, {
      data: {
        name: 'Zone e2e selects',
        color: '#3b82f6',
        coordinates: [
          [48.85, 2.35],
          [48.86, 2.35],
          [48.86, 2.36],
        ],
        zoneTypes: ['OTHER'],
      },
    })
    if (!r.ok()) throw new Error(`création de zone impossible : ${r.status()} ${await r.text()}`)
    const corps = await r.json()
    zoneId = corps?.data?.zone?.id ?? ''
    if (!zoneId) throw new Error(`id de zone illisible : ${JSON.stringify(corps).slice(0, 200)}`)
    await context.close()
  })

  // L'édition est partagée entre les specs : ce qu'on y ajoute, on le retire. Dans `afterAll`,
  // et non dans un dernier `test()`, qui serait sauté si un test précédent échouait.
  test.afterAll(async ({ browser }) => {
    if (!zoneId) return
    const { editionId } = loadState()
    const context = await browser.newContext({ storageState: AUTH })
    const page = await context.newPage()
    const r = await apiDelete(page, `${BASE}/api/editions/${editionId}/zones/${zoneId}`)
    if (!r.ok()) console.error(`ménage incomplet : zone ${zoneId} non supprimée (${r.status()})`)
    await context.close()
  })

  /** Ouvre le formulaire d'ajout de point de repère en posant un point sur la carte. */
  async function ouvrirFormulairePointDeRepere(page: Page) {
    const { editionId } = loadState()
    await page.goto(`${BASE}/editions/${editionId}/gestion/map`, { waitUntil: 'domcontentloaded' })

    const carte = page.locator('.leaflet-container').first()
    await expect(carte).toBeVisible({ timeout: 30000 })

    await page.getByRole('button', { name: 'Placer un point de repère' }).first().click()
    const boite = (await carte.boundingBox())!
    await page.mouse.click(boite.x + boite.width / 2, boite.y + boite.height / 2)

    const dialogue = page.getByRole('dialog')
    await expect(dialogue).toBeVisible()
    return dialogue
  }

  /**
   * Déplie le champ portant ce libellé et rend son menu.
   *
   * On passe par l'étiquette et par `aria-controls` plutôt que par un rôle ou un index : les deux
   * selects de cette modale ne se ressemblent pas — le premier est un `combobox`, le second un
   * bouton `aria-haspopup="listbox"` dont le nom accessible est « Show popup ».
   */
  async function deplier(page: Page, dialogue: Locator, libelle: string) {
    const etiquette = dialogue.locator('label').filter({ hasText: libelle }).first()
    const id = await etiquette.getAttribute('for')
    expect(id, `étiquette « ${libelle} » sans champ associé`).toBeTruthy()

    const declencheur = dialogue.locator(`#${id}`)
    const menuId = await declencheur.getAttribute('aria-controls')
    await declencheur.click()

    const menu = page.locator(`#${menuId}`)
    await expect(menu).toBeVisible()
    return menu
  }

  /**
   * Ce que touche l'utilisateur au sommet du menu : le menu lui-même, ou ce qui le recouvre.
   *
   * La comparaison se fait sur l'élément de menu exact, et non sur un sélecteur de famille : le
   * dialogue porte lui aussi `data-slot="content"`, si bien qu'un `closest` générique répondait
   * « le menu » pour n'importe quel morceau de la modale — la mesure ne prouvait alors rien.
   */
  async function elementAuSommetDuMenu(menu: Locator) {
    const b = (await menu.boundingBox())!
    return menu.evaluate(
      (el, { x, y }) => {
        const cible = document.elementFromPoint(x, y) as HTMLElement | null
        if (!cible) return 'rien'
        return el.contains(cible) ? 'le menu' : `${cible.tagName}.${cible.className}`.slice(0, 100)
      },
      { x: b.x + b.width / 2, y: b.y + 6 }
    )
  }

  test('le menu des types de point de repère n’est pas masqué par la modale', async ({ page }) => {
    const dialogue = await ouvrirFormulairePointDeRepere(page)
    const menu = await deplier(page, dialogue, 'Type(s) de point de repère')

    // Le menu est téléporté hors du dialogue : c'est précisément ce qui le rendait vulnérable à
    // l'empilement. On le constate, pour que la spec dise pourquoi la mesure suivante existe.
    expect(await menu.evaluate((el) => !!el.closest('[role=dialog]'))).toBe(false)
    expect(await elementAuSommetDuMenu(menu)).toBe('le menu')

    // Et la conséquence qui compte : on peut réellement choisir. Le select étant `multiple`, le
    // menu reste ouvert après le clic — c'est la sélection qu'on observe, pas la fermeture.
    const options = menu.getByRole('option')
    await options.first().click()
    await expect(options.first()).toHaveAttribute('aria-selected', 'true')
  })

  test('le menu de la zone de rattachement n’est pas masqué non plus', async ({ page }) => {
    const dialogue = await ouvrirFormulairePointDeRepere(page)
    const menu = await deplier(page, dialogue, 'Zone de rattachement')

    expect(await elementAuSommetDuMenu(menu)).toBe('le menu')
    await expect(menu.getByRole('option').filter({ hasText: 'Zone e2e selects' })).toBeVisible()
  })
})
