import { expect, test } from '@nuxt/test-utils/playwright'

import { loadState } from '../helpers'

const BASE = 'http://localhost:3000'
const AUTH = new URL('../../../../test-results/.auth/user.json', import.meta.url).pathname

/**
 * L'accueil de gestion annonce chaque module par une icône d'une certaine couleur. Sa page doit
 * porter la même, dans son titre.
 *
 * Ce test ne compare pas les pages à une table écrite ici — il les compare **à l'accueil**, lu à
 * l'écran. C'est le seul énoncé qui vaut : le défaut d'origine était précisément que les deux
 * côtés se contredisaient sans que rien ne le signale. Treize pages n'affichaient aucune icône,
 * cinq en affichaient une autre que leur carte, huit la bonne dans la mauvaise couleur.
 *
 * Il parcourt les cartes réellement présentes sur l'accueil de cette édition, et non une liste
 * figée : une édition n'allume pas tous ses modules, et une liste figée aurait fini par tester des
 * pages inaccessibles.
 */
test.describe('Titres des pages de gestion', () => {
  /** Le nom de l'icône, tel que Nuxt Icon l'inscrit dans les classes de l'élément. */
  const nomIcone = (classes: string) =>
    classes.split(/\s+/).find((c) => /^i-[a-z]/.test(c) || c.includes(':')) ?? ''

  async function ouvrir(browser: import('@playwright/test').Browser) {
    const context = await browser.newContext({
      storageState: AUTH,
      viewport: { width: 1280, height: 900 },
      locale: 'fr-FR',
    })
    return { page: await context.newPage(), context }
  }

  test('chaque page reprend l’icône et la couleur de sa carte d’accueil', async ({ browser }) => {
    const { editionId } = loadState()
    const { page, context } = await ouvrir(browser)

    await page.goto(`${BASE}/editions/${editionId}/gestion`, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-carte-gestion]').first()).toBeVisible({ timeout: 40000 })

    // Ce que l'accueil promet, carte par carte.
    const promesses = await page
      .locator('[data-carte-gestion][href*="/gestion/"]')
      .evaluateAll((cartes) =>
        cartes
          .map((carte) => {
            const icone = carte.querySelector('span[class*="i-"], span[class*=":"]')
            if (!icone) return null
            return {
              href: carte.getAttribute('href') ?? '',
              titre: carte.querySelector('h3')?.textContent?.trim() ?? '',
              classes: icone.getAttribute('class') ?? '',
              couleur: getComputedStyle(icone).color,
            }
          })
          .filter((c): c is NonNullable<typeof c> => c !== null)
      )

    // Une carte par écran : l'accueil mène plusieurs fois au même (les repas y figurent deux
    // fois), et l'on ne gagne rien à ouvrir deux fois la même page.
    const parHref = new Map(promesses.map((p) => [p.href, p]))

    /*
     * Huit cartes, et non les quarante-deux du registre : l'édition du harnais garde ses modules
     * optionnels éteints, et `features-toggle` le vérifie. Les allumer ici déplacerait simplement
     * le problème sur cette spec-là — le commentaire d'`activerBenevolatTemporairement` raconte
     * l'incident.
     *
     * Ce que ce test prouve reste donc le mécanisme lui-même, de bout en bout : registre → lecture
     * par la route → icône et couleur rendues. Que chaque module du registre déclare une couleur
     * traduisible et une icône, c'est le test unitaire `modules-de-gestion` qui s'en charge, et il
     * les couvre tous.
     */
    expect(parHref.size, 'aucune carte lue sur l’accueil').toBeGreaterThanOrEqual(8)

    const ecarts: string[] = []

    for (const promesse of parHref.values()) {
      await page.goto(`${BASE}${promesse.href}`, { waitUntil: 'domcontentloaded' })

      const entete = page.locator('[data-entete-page]').first()
      // `waitFor` et non `isVisible` : cette dernière tranche sur l'instant, son option `timeout`
      // ne la fait pas patienter. Les huit pages étaient ainsi déclarées sans titre alors qu'elles
      // n'avaient simplement pas fini de s'afficher.
      const affiche = await entete
        .waitFor({ state: 'visible', timeout: 30000 })
        .then(() => true)
        .catch(() => false)
      if (!affiche) {
        // Ne pas passer outre : une carte de l'accueil qui mène à une page sans titre est
        // exactement l'un des défauts que ce test existe pour attraper.
        ecarts.push(`${promesse.href} : aucun titre de page (carte : ${promesse.titre})`)
        continue
      }

      const icone = entete.locator('[data-entete-icone]')
      if ((await icone.count()) === 0) {
        ecarts.push(`${promesse.href} : aucune icône dans le titre (carte : ${promesse.titre})`)
        continue
      }

      const vu = await icone.evaluate((el) => ({
        classes: el.getAttribute('class') ?? '',
        couleur: getComputedStyle(el).color,
      }))

      if (nomIcone(vu.classes) !== nomIcone(promesse.classes)) {
        ecarts.push(
          `${promesse.href} : icône ${nomIcone(vu.classes)} dans le titre, ` +
            `${nomIcone(promesse.classes)} sur la carte`
        )
      }
      if (vu.couleur !== promesse.couleur) {
        ecarts.push(
          `${promesse.href} : couleur ${vu.couleur} dans le titre, ${promesse.couleur} sur la carte`
        )
      }
    }

    expect(ecarts, `écarts entre l’accueil et les pages :\n${ecarts.join('\n')}`).toEqual([])

    await context.close()
  })

  test('la couleur est bien appliquée, et non laissée à celle du texte', async ({ browser }) => {
    const { editionId } = loadState()
    const { page, context } = await ouvrir(browser)

    // Le défaut qui a lancé ce chantier : une couleur absente de la table donnait la classe
    // « rounded-lg undefined », et l'icône prenait la couleur du texte — sans erreur ni
    // avertissement. Une vérification par nom de classe l'aurait laissée passer ; celle-ci lit la
    // couleur calculée et exige qu'elle diffère de celle du titre voisin.
    await page.goto(`${BASE}/editions/${editionId}/gestion/general-info`, {
      waitUntil: 'domcontentloaded',
    })

    const entete = page.locator('[data-entete-page]').first()
    await expect(entete).toBeVisible({ timeout: 40000 })

    const couleurs = await entete.evaluate((el) => ({
      icone: getComputedStyle(el.querySelector('[data-entete-icone]')!).color,
      titre: getComputedStyle(el.querySelector('h1')!).color,
    }))

    expect(couleurs.icone).not.toBe(couleurs.titre)
    expect(couleurs.icone).not.toBe('rgba(0, 0, 0, 0)')

    await context.close()
  })

  test('un écran de module porte un titre de 24 px en gras', async ({ browser }) => {
    const { editionId } = loadState()
    const { page, context } = await ouvrir(browser)

    // Sept variantes de classes s'étaient installées sur les `h1` recopiés d'une page à l'autre.
    // Le composant n'en laisse plus que deux, selon le niveau : celle-ci est celle d'un écran.
    await page.goto(`${BASE}/editions/${editionId}/gestion/stock`, {
      waitUntil: 'domcontentloaded',
    })
    const h1 = page.locator('[data-entete-page] h1').first()
    await expect(h1).toBeVisible({ timeout: 40000 })

    const style = await h1.evaluate((el) => {
      const s = getComputedStyle(el)
      return { px: parseFloat(s.fontSize), poids: Number(s.fontWeight) }
    })
    expect(style.px).toBeCloseTo(24, 0)
    expect(style.poids).toBe(700)

    await context.close()
  })
})
