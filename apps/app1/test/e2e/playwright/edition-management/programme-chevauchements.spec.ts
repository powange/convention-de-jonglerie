import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPost, loadState, updateEdition } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * La frise de gestion signale deux moments qui se disputent le même lieu au même instant.
 *
 * ## ⚠️ POURQUOI UNE SPÉCIFICATION, ET POURQUOI SUR CETTE PAGE
 *
 * `detecterChevauchements` est une fonction pure, largement couverte par des tests unitaires. Ce
 * qui n'était couvert par RIEN, c'est la page : `gestion/program.vue` n'avait **aucun** test —
 * ni Nuxt, ni Playwright.
 *
 * Or c'est précisément le fichier qui a rendu une **page blanche deux fois**, pour la même cause
 * les deux fois : un appel évalué pendant le `setup`. Une page de gestion est rendue côté client,
 * donc un `curl` y répond 200 sans rien prouver — seul un navigateur authentifié exécute le
 * composant. Ajouter une pastille dans son gabarit sans moyen de voir un écran blanc aurait été
 * faire confiance à la relecture là où l'historique dit de ne pas le faire.
 *
 * Ce test mesure donc **deux choses** : que la page se rend, et que la pastille apparaît.
 *
 * ## Le décor
 *
 * Une zone, puis deux éléments de programme qui s'y recouvrent — 10 h-12 h et 11 h-13 h. Les
 * dates sont **relatives au jour du test** : des dates figées en dur finissent par tomber dans le
 * passé, et ce dépôt a déjà perdu des tests pour cette seule raison.
 *
 * ⚠️ Le nettoyage se fait **par identifiant**, jamais par position dans une liste : la base de
 * développement est partagée, et un `.last()` sur un bouton « Supprimer » y a déjà détruit de
 * vraies données.
 */
test.describe.serial('Programme — chevauchements au même lieu', () => {
  test.describe.configure({ timeout: 120000 })

  let zoneId: number | null = null
  const itemIds: number[] = []
  let editionId: string

  /** Le lendemain à l'heure dite, en UTC : un décor qui ne vieillit pas. */
  const demainA = (heure: number) => {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() + 1)
    d.setUTCHours(heure, 0, 0, 0)
    return d.toISOString()
  }

  test('la page se rend, et signale les deux moments en conflit', async ({ page, goto }) => {
    editionId = String(loadState().editionId)
    await updateEdition(page, editionId, { programEnabled: true, siteMapEnabled: true })

    const zone = await apiPost(page, `${BASE}/api/editions/${editionId}/zones`, {
      data: {
        name: 'Chapiteau du test de chevauchement',
        color: '#FF8800',
        coordinates: [
          [43.92, 5.11],
          [43.93, 5.11],
          [43.93, 5.12],
        ],
      },
    })
    expect(zone.ok(), await zone.text()).toBe(true)
    /*
     * ⚠️ L'IDENTIFIANT EST SOUS `data.zone.id`, et non `data.id` : le point d'API répond
     * `createSuccessResponse({ zone })`. Ma première version lisait `data.id`, et la CI l'a dit —
     * la zone était bien créée, mais l'identifiant restait nul.
     *
     * 📍 La spécification voisine `carte-menu-empilement.spec.ts` portait la MÊME lecture fausse,
     * et comme elle ne s'en sert que pour son nettoyage, celui-ci ne supprimait RIEN : elle
     * laissait une zone derrière elle à chaque passage de CI, sans que rien ne le dise. Corrigée
     * dans le même lot.
     */
    const corpsZone = await zone.json()
    zoneId = (corpsZone?.data?.zone ?? corpsZone?.zone ?? corpsZone?.data ?? corpsZone)?.id ?? null
    expect(zoneId, JSON.stringify(corpsZone).slice(0, 200)).toBeTruthy()

    for (const [titre, debut, fin] of [
      ['Atelier qui chevauche', demainA(10), demainA(12)],
      ['Scène ouverte qui chevauche', demainA(11), demainA(13)],
    ] as const) {
      const r = await apiPost(page, `${BASE}/api/editions/${editionId}/program-items`, {
        data: { title: titre, startDateTime: debut, endDateTime: fin, zoneId, isPublic: false },
      })
      expect(r.ok(), await r.text()).toBe(true)
      const corps = await r.json()
      itemIds.push((corps?.data?.item ?? corps?.item ?? corps)?.id)
    }

    await goto(`/editions/${editionId}/gestion/program`, { waitUntil: 'hydration' })

    /*
     * ⚠️ LA MESURE QUI ATTRAPE LA PAGE BLANCHE. Un titre visible prouve que le `setup` est allé
     * au bout : une erreur en cours de `setup` laisse la page vide, sans même le gabarit.
     */
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 25000 })
    await expect(page.getByText('Atelier qui chevauche')).toBeVisible({ timeout: 20000 })
    await expect(page.getByText('Scène ouverte qui chevauche')).toBeVisible()

    /*
     * La pastille apparaît sur LES DEUX lignes. Compter deux occurrences et non une : le défaut
     * le plus probable d'une détection de chevauchement est de ne signaler que le second des deux
     * moments, celui qu'on a rencontré en dernier.
     */
    await expect(page.getByText('Chevauchement', { exact: true })).toHaveCount(2, {
      timeout: 20000,
    })
  })

  test('aucune pastille quand les deux moments ne font que se suivre', async ({ page, goto }) => {
    /*
     * ⚠️ LE TÉMOIN NÉGATIF, sans lequel le test précédent ne prouverait pas grand-chose : une
     * pastille affichée sur TOUTE ligne le satisferait aussi. 10 h-11 h puis 11 h-12 h dans la
     * même zone, c'est un enchaînement — le cas le plus ordinaire d'un programme.
     */
    for (const id of itemIds.splice(0)) {
      await apiDelete(page, `${BASE}/api/editions/${editionId}/program-items/${id}`)
    }

    for (const [titre, debut, fin] of [
      ['Atelier qui enchaîne', demainA(10), demainA(11)],
      ['Scène ouverte qui enchaîne', demainA(11), demainA(12)],
    ] as const) {
      const r = await apiPost(page, `${BASE}/api/editions/${editionId}/program-items`, {
        data: { title: titre, startDateTime: debut, endDateTime: fin, zoneId, isPublic: false },
      })
      expect(r.ok(), await r.text()).toBe(true)
      const corps = await r.json()
      itemIds.push((corps?.data?.item ?? corps?.item ?? corps)?.id)
    }

    await goto(`/editions/${editionId}/gestion/program`, { waitUntil: 'hydration' })
    await expect(page.getByText('Atelier qui enchaîne')).toBeVisible({ timeout: 25000 })
    await expect(page.getByText('Scène ouverte qui enchaîne')).toBeVisible()
    await expect(page.getByText('Chevauchement', { exact: true })).toHaveCount(0)
  })

  test.afterAll(async ({ browser }) => {
    /*
     * Décor retiré par IDENTIFIANT. La base de développement est partagée entre les lots
     * Playwright et le travail de l'utilisateur : viser par position y a déjà détruit de vraies
     * données.
     */
    const page = await browser.newPage()
    try {
      for (const id of itemIds) {
        if (id) await apiDelete(page, `${BASE}/api/editions/${editionId}/program-items/${id}`)
      }
      if (zoneId) await apiDelete(page, `${BASE}/api/editions/${editionId}/zones/${zoneId}`)
    } finally {
      await page.close()
    }
  })
})
