import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPost, loadState, updateEdition } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Trier les tâches par échéance.
 *
 * Demandé par une utilisatrice : la page affichait une échéance sur chaque ligne mais les
 * ordonnait par position manuelle, sans moyen de les classer par date. Il existait des filtres
 * (« en retard », « dans 7 jours »…), jamais de tri.
 *
 * Ce que ce test protège au-delà de l'ordre : les tâches SANS échéance restent en dernier dans
 * les DEUX sens. Un comparateur naïf sur `null` les remonterait en tête du tri décroissant,
 * laissant croire qu'elles sont les plus lointaines — alors qu'elles n'ont pas de date du tout.
 */
test.describe.serial('Tâches — tri par échéance', () => {
  test.describe.configure({ timeout: 120000 })

  const TITRES = ['Lointaine', 'Proche', 'Sans date', 'Moyenne']
  let groupId: number | null = null

  /**
   * Le sélecteur de tri se repère à l'ensemble de ses libellés possibles : viser le seul
   * « Ordre manuel » le ferait disparaître dès le premier changement, puisque le libellé
   * affiché devient celui de l'option retenue.
   */
  const selecteurDeTri = (page: import('@playwright/test').Page) =>
    page
      .getByRole('combobox')
      .filter({ hasText: /ordre manuel|la plus proche|la plus lointaine/i })
      .first()

  const ordreAffiche = (page: import('@playwright/test').Page) =>
    page.evaluate(
      (titres) =>
        [...document.querySelectorAll('h3, [class*="font-medium"]')]
          .map((e) => (e.textContent || '').trim())
          .filter((t) => titres.includes(t)),
      TITRES
    )

  test('préparer un groupe de tâches aux échéances variées', async ({ page }) => {
    const { editionId } = loadState()
    await updateEdition(page, String(editionId), { tasksEnabled: true })

    const reponse = await apiPost(page, `${BASE}/api/editions/${editionId}/task-groups`, {
      data: { name: 'Tri par échéance', description: '' },
    })
    expect(reponse.ok()).toBe(true)
    const corps = await reponse.json()
    groupId = (corps.data?.group ?? corps.data ?? corps)?.id
    expect(groupId).toBeTruthy()

    // Créées dans le désordre : si elles l'étaient déjà triées, le test passerait sans rien
    // prouver — l'ordre manuel suffirait.
    const dans = (jours: number) => new Date(Date.now() + jours * 86400000).toISOString()
    for (const [titre, echeance] of [
      ['Lointaine', dans(30)],
      ['Proche', dans(1)],
      ['Sans date', null],
      ['Moyenne', dans(10)],
    ] as const) {
      const r = await apiPost(
        page,
        `${BASE}/api/editions/${editionId}/task-groups/${groupId}/tasks`,
        { data: { title: titre, ...(echeance ? { deadline: echeance } : {}) } }
      )
      expect(r.ok(), `création de « ${titre} » : ${await r.text()}`).toBe(true)
    }
  })

  test('ordre manuel par défaut, puis tri dans les deux sens', async ({ page, goto }) => {
    // Un seul test pour tout le parcours : chaque `test()` reçoit une page neuve, et scinder
    // ferait repartir les suivants d'une page vide. C'est aussi le trajet réel d'un
    // organisateur — il ouvre la page, puis change de tri.
    const { editionId } = loadState()
    await goto(`/editions/${editionId}/gestion/tasks/${groupId}`, { waitUntil: 'hydration' })
    await expect(selecteurDeTri(page)).toBeVisible({ timeout: 20000 })

    // L'ordre manuel porte une intention : il ne doit pas être remplacé sans qu'on le demande.
    expect(await ordreAffiche(page)).toEqual(['Lointaine', 'Proche', 'Sans date', 'Moyenne'])

    await selecteurDeTri(page).click()
    await page.getByRole('option', { name: /la plus proche/i }).click()
    await expect
      .poll(() => ordreAffiche(page))
      .toEqual(['Proche', 'Moyenne', 'Lointaine', 'Sans date'])

    // Le choix se garde dans l'URL, comme les filtres : un lien partagé conserve le tri.
    // Attendu plutôt que photographié : `router.replace` s'exécute après le rendu de la liste.
    await expect.poll(() => new URL(page.url()).searchParams.get('sort')).toBe('deadline_asc')

    await selecteurDeTri(page).click()
    await page.getByRole('option', { name: /la plus lointaine/i }).click()
    await expect
      .poll(() => ordreAffiche(page))
      .toEqual(['Lointaine', 'Moyenne', 'Proche', 'Sans date'])
  })

  test('glisser une carte sous un tri ne réécrit pas l’ordre manuel', async ({ page, goto }) => {
    const { editionId } = loadState()

    // Il n'existe pas de GET pour un groupe seul : la page lit la liste complète.
    const ordreEnBase = async () => {
      const r = await page.request.get(`${BASE}/api/editions/${editionId}/task-groups`)
      const c = await r.json()
      const groupes = c.data?.groups ?? c.groups ?? []
      const groupe = groupes.find((g: { id: number }) => g.id === groupId)
      return (groupe?.tasks ?? []).map((t: { title: string }) => t.title)
    }

    /**
     * `dragTo` de Playwright déplace la souris, ce qui ne réveille pas le glisser-déposer HTML5 :
     * vérifié, l'ordre en base ne bougeait pas même sans tri. Les évènements sont donc émis à la
     * main, avec le `DataTransfer` que les gestionnaires attendent.
     */
    const glisser = (depuis: string, vers: string) =>
      page.evaluate(
        ([titreSource, titreCible]) => {
          const cartes = [...document.querySelectorAll('[draggable="true"]')]
          const trouve = (t: string) => cartes.find((c) => (c.textContent || '').includes(t))
          const source = trouve(titreSource!)
          const cible = trouve(titreCible!)
          if (!source || !cible)
            throw new Error(`carte introuvable : ${titreSource} / ${titreCible}`)

          const dt = new DataTransfer()
          const emettre = (el: Element, type: string) => {
            const r = el.getBoundingClientRect()
            el.dispatchEvent(
              new DragEvent(type, {
                bubbles: true,
                cancelable: true,
                dataTransfer: dt,
                // Sous le milieu : le dépôt se fait « après » la carte visée.
                clientY: r.top + r.height * 0.75,
                clientX: r.left + r.width / 2,
              })
            )
          }
          emettre(source, 'dragstart')
          emettre(cible, 'dragover')
          emettre(cible, 'drop')
        },
        [depuis, vers]
      )

    const enKanban = async (query = '') => {
      await goto(`/editions/${editionId}/gestion/tasks/${groupId}${query}`, {
        waitUntil: 'hydration',
      })
      await page.getByRole('tab', { name: /kanban/i }).click()
      await expect(page.locator('[draggable="true"]').first()).toBeVisible({ timeout: 10000 })
    }

    // CONTRÔLE : en ordre manuel, le geste doit VRAIMENT déplacer la tâche en base.
    await enKanban()
    const avantControle = await ordreEnBase()
    await glisser('Lointaine', 'Moyenne')
    await page.waitForTimeout(2500)
    const apresControle = await ordreEnBase()
    expect(apresControle, 'le glisser-déposer doit agir en ordre manuel').not.toEqual(avantControle)

    // CAS ÉTUDIÉ : le même geste, tri par échéance actif.
    await enKanban('?sort=deadline_asc')
    const avantTri = await ordreEnBase()
    await glisser('Proche', 'Lointaine')
    await page.waitForTimeout(2500)
    const apresTri = await ordreEnBase()
    expect(apresTri).toEqual(avantTri)

    // Et l'organisateur sait pourquoi rien n'a bougé.
    await expect(page.getByText(/ordre manuel.*réordonner/i).first()).toBeVisible({
      timeout: 5000,
    })
  })

  test('un titre long revient à la ligne au lieu d’être coupé', async ({ page, goto }) => {
    // Signalé par un organisateur : en vue liste, la fin des titres longs disparaissait derrière
    // une ellipse — or c'est souvent là qu'est le détail qui distingue deux tâches proches.
    const { editionId } = loadState()
    const TITRE_LONG =
      'Réserver la grande salle polyvalente auprès de la mairie et confirmer les horaires ' +
      'de montage avec le gardien avant la fin du mois'

    const r = await apiPost(page, `${BASE}/api/editions/${editionId}/task-groups/${groupId}/tasks`, {
      data: { title: TITRE_LONG, description: '' },
    })
    expect(r.ok(), await r.text()).toBe(true)

    await goto(`/editions/${editionId}/gestion/tasks/${groupId}`, { waitUntil: 'hydration' })
    const titre = page.getByText(TITRE_LONG, { exact: true }).first()
    await expect(titre).toBeVisible({ timeout: 20000 })

    // Le symptôme se mesure sur la boîte, pas sur la classe : un titre coupé tient sur une seule
    // ligne et son texte déborde de sa largeur. Ici il doit occuper plusieurs lignes.
    const mesures = await titre.evaluate((el) => {
      const style = getComputedStyle(el)
      return {
        blancs: style.whiteSpace,
        hauteur: el.getBoundingClientRect().height,
        hauteurDeLigne: parseFloat(style.lineHeight) || 20,
        debordeEnLargeur: el.scrollWidth > el.clientWidth + 1,
      }
    })
    expect(mesures.blancs).not.toBe('nowrap')
    expect(mesures.debordeEnLargeur).toBe(false)
    expect(mesures.hauteur).toBeGreaterThan(mesures.hauteurDeLigne * 1.5)
  })

  test('nettoyer : rendre l’édition telle qu’on l’a trouvée', async ({ page }) => {
    const { editionId } = loadState()
    if (groupId) {
      await apiDelete(page, `${BASE}/api/editions/${editionId}/task-groups/${groupId}`).catch(
        () => {}
      )
    }
    // Les specs partagent une seule édition : laisser les tâches activées ferait échouer
    // `features-toggle`, qui vérifie ensuite que tout est désactivé.
    await updateEdition(page, String(editionId), { tasksEnabled: false })
  })
})
