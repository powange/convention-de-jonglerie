import { expect, test } from '@nuxt/test-utils/playwright'

import { apiPost, loadState, updateEdition } from '../helpers'

/**
 * L'ordre de base des objets d'un groupe : il s'affiche, il se change, et il disparaît si on trie.
 *
 * ⚠️ POURQUOI CE TEST EXISTE. `StockItem.displayOrder` était en base depuis l'origine et le point
 * d'API de liste l'ordonnait déjà — mais le tableau DÉMARRAIT trié par nom. Cet ordre n'était donc
 * jamais visible, et rien ne le signalait : la page répond 200, le typage est satisfait, et les
 * tests de composant ne regardent pas dans quel ordre les lignes sortent.
 *
 * 📍 Et c'est la règle demandée qui se vérifie ici : dès qu'une COLONNE est triée, l'affichage est
 * recalculé depuis cette colonne, et déplacer une ligne n'y voudrait plus rien dire. Les poignées
 * et les boutons DISPARAISSENT alors — un bouton grisé fait cliquer, puis chercher pourquoi rien
 * ne se passe.
 *
 * On mesure l'ORDRE DES LIGNES, pas une capture d'écran : trois noms lus dans le corps du tableau.
 * Les actions, elles, visent par identité — la ligne qui porte tel nom, jamais « la dernière ».
 */

const PREFIXE = 'OrdreE2E'
const ALPHA = `${PREFIXE} Alpha`
const BRAVO = `${PREFIXE} Bravo`
const CHARLIE = `${PREFIXE} Charlie`

test.describe.serial('Stock : ordre de base des objets d’un groupe', () => {
  let groupId: number | null = null

  test.beforeAll(() => {
    const { editionId } = loadState()
    if (!editionId) throw new Error('editionId manquant dans state.json (setup global non joué)')
  })

  test('préparer un groupe de trois objets', async ({ page }) => {
    const { editionId } = loadState()
    await updateEdition(page, String(editionId), { stockEnabled: true })

    const groupe = await apiPost(
      page,
      `http://localhost:3000/api/editions/${editionId}/stock-groups`,
      { data: { name: 'Ordre E2E', description: 'Groupe pour l’ordre des objets' } }
    )
    expect(groupe.ok()).toBe(true)
    groupId = (await groupe.json())?.data?.group?.id
    expect(groupId).toBeTruthy()

    // Créés dans cet ordre, donc `displayOrder` 0, 1, 2 — la création prend le rang suivant.
    // Les noms sont volontairement dans l'ordre alphabétique INVERSE de l'ordre voulu plus bas,
    // sans quoi un tri par nom laissé actif donnerait le même résultat et ne prouverait rien.
    for (const name of [CHARLIE, BRAVO, ALPHA]) {
      const objet = await apiPost(
        page,
        `http://localhost:3000/api/editions/${editionId}/stock-groups/${groupId}/items`,
        { data: { name, quantity: 1 } }
      )
      expect(objet.ok()).toBe(true)
    }
  })

  test('l’ordre affiché est celui du groupe, pas l’ordre alphabétique', async ({ page, goto }) => {
    const { editionId } = loadState()
    if (!groupId) throw new Error('groupId manquant')

    await page.setViewportSize({ width: 1400, height: 900 })
    await ouvrirLeGroupe(page, goto, editionId, groupId)

    // Créés Charlie, Bravo, Alpha : c'est cet ordre qui doit sortir. Un tri par nom aurait rendu
    // Alpha, Bravo, Charlie — l'assertion distingue donc bien les deux.
    expect(await nomsAffiches(page)).toEqual([CHARLIE, BRAVO, ALPHA])
  })

  test('« Monter » déplace l’objet, et le déplacement est conservé', async ({ page, goto }) => {
    const { editionId } = loadState()
    if (!groupId) throw new Error('groupId manquant')

    await page.setViewportSize({ width: 1400, height: 900 })
    await ouvrirLeGroupe(page, goto, editionId, groupId)

    // Par IDENTITÉ : la ligne qui porte ce nom, pas la troisième ligne.
    await ligneDe(page, ALPHA).getByRole('button', { name: 'Monter' }).click()

    await expect.poll(() => nomsAffiches(page), { timeout: 15000 }).toEqual([CHARLIE, ALPHA, BRAVO])

    // Rechargement : ce qui compte est que le serveur ait retenu l'ordre, pas que l'écran l'ait
    // réarrangé localement.
    await ouvrirLeGroupe(page, goto, editionId, groupId)
    expect(await nomsAffiches(page)).toEqual([CHARLIE, ALPHA, BRAVO])
  })

  test('glisser une poignée déplace l’objet', async ({ page, goto }) => {
    const { editionId } = loadState()
    if (!groupId) throw new Error('groupId manquant')

    await page.setViewportSize({ width: 1400, height: 900 })
    await ouvrirLeGroupe(page, goto, editionId, groupId)

    // L'état laissé par le test précédent.
    expect(await nomsAffiches(page)).toEqual([CHARLIE, ALPHA, BRAVO])

    /*
     * Un vrai glissement, pas `dragTo` : SortableJS écoute `mousedown`/`mousemove`/`mouseup` et
     * ignore l'API glisser-déposer du navigateur. Il faut aussi DÉPASSER son seuil de départ par
     * un premier petit mouvement, sinon le geste est pris pour un clic.
     */
    const poignees = page.locator('tbody.objets-du-groupe .poignee-ordre')
    const depart = await poignees.first().boundingBox()
    const arrivee = await poignees.nth(2).boundingBox()
    if (!depart || !arrivee) throw new Error('poignées introuvables')

    const x = depart.x + depart.width / 2
    const yDepart = depart.y + depart.height / 2
    // Au-DELÀ du milieu de la dernière ligne : SortableJS ne permute qu'une fois ce milieu franchi,
    // et s'arrêter pile dessus laissait le geste sans effet une fois sur deux.
    const yArrivee = arrivee.y + arrivee.height

    await page.mouse.move(x, yDepart)
    await page.mouse.down()
    // Un premier petit mouvement pour dépasser le seuil de départ, puis une descente franchement
    // progressive : c'est le passage par les positions intermédiaires qui déclenche les permutations.
    await page.mouse.move(x, yDepart + 10, { steps: 3 })
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(x, yDepart + ((yArrivee - yDepart) * i) / 10, { steps: 3 })
    }
    // L'animation dure 150 ms : relâcher avant sa fin rendait l'ordre final indécis.
    await page.waitForTimeout(300)
    await page.mouse.up()

    // Charlie, premier, passe en dernier.
    await expect.poll(() => nomsAffiches(page), { timeout: 15000 }).toEqual([ALPHA, BRAVO, CHARLIE])

    // Et le serveur l'a retenu — c'est tout l'intérêt par rapport à un réarrangement local.
    await ouvrirLeGroupe(page, goto, editionId, groupId)
    expect(await nomsAffiches(page)).toEqual([ALPHA, BRAVO, CHARLIE])
  })

  test('trier une colonne retire les poignées, et « Retirer le tri » les ramène', async ({
    page,
    goto,
  }) => {
    const { editionId } = loadState()
    if (!groupId) throw new Error('groupId manquant')

    await page.setViewportSize({ width: 1400, height: 900 })
    await ouvrirLeGroupe(page, goto, editionId, groupId)

    const boutonsMonter = page.getByRole('button', { name: 'Monter' })
    expect(await boutonsMonter.count()).toBeGreaterThan(0)

    await page.getByRole('button', { name: /Nom de l’objet|Nom de l'objet/ }).click()

    // Le tri a bien eu lieu : l'ordre alphabétique, et non plus celui du groupe.
    await expect.poll(() => nomsAffiches(page), { timeout: 15000 }).toEqual([ALPHA, BRAVO, CHARLIE])

    // Et le déplacement n'est plus proposé — ni poignée, ni bouton.
    await expect(boutonsMonter).toHaveCount(0)
    await expect(page.locator('tbody.objets-du-groupe .poignee-ordre')).toHaveCount(0)
    await expect(
      page.getByText('Le tableau est trié par une colonne', { exact: false })
    ).toBeVisible()

    await page.getByRole('button', { name: 'Retirer le tri' }).click()

    // L'ordre du groupe revient — ici le même que l'alphabétique, le glissement précédent l'ayant
    // amené là ; ce qui se vérifie est le RETOUR des poignées.
    await expect.poll(() => nomsAffiches(page), { timeout: 15000 }).toEqual([ALPHA, BRAVO, CHARLIE])
    expect(await boutonsMonter.count()).toBeGreaterThan(0)
  })
})

/**
 * Ouvre la page du groupe et attend que les trois objets soient là.
 *
 * ⚠️ `toPass` et non un simple `goto` : en local, la première visite compile la page côté serveur
 * et la navigation peut dépasser le délai. Les specs voisines prennent la même précaution.
 */
async function ouvrirLeGroupe(
  page: Parameters<typeof nomsAffiches>[0],
  goto: (url: string, options?: { waitUntil?: 'hydration' }) => Promise<unknown>,
  editionId: string | number,
  groupId: number
) {
  await expect(async () => {
    await goto(`/editions/${editionId}/gestion/stock/${groupId}`, { waitUntil: 'hydration' })
    // Les TROIS, et pas seulement l'un d'eux : attendre une ligne ne dit pas que les autres sont
    // rendues, et l'assertion qui suit porte sur leur ordre RELATIF. Un passage sur sept tombait
    // là, sur une liste encore incomplète.
    for (const nom of [ALPHA, BRAVO, CHARLIE]) {
      await expect(page.getByText(nom)).toBeVisible({ timeout: 5000 })
    }
  }).toPass({ timeout: 30000, intervals: [2000, 3000, 5000] })
}

/** La ligne du tableau qui porte ce nom. */
function ligneDe(page: any, nom: string) {
  return page.locator('tbody.objets-du-groupe tr').filter({ hasText: nom })
}

/**
 * Les noms des objets du test, dans l'ordre où le tableau les rend.
 *
 * 📍 Filtré sur le préfixe : le groupe pourrait contenir d'autres objets laissés par une spec
 * voisine, et l'assertion porte sur l'ORDRE RELATIF des trois nôtres.
 */
async function nomsAffiches(page: {
  locator: (s: string) => { allTextContents: () => Promise<string[]> }
}) {
  const textes = await page.locator('tbody.objets-du-groupe tr').allTextContents()
  return textes
    .map((t) => t.match(new RegExp(`${PREFIXE} \\w+`))?.[0])
    .filter((n): n is string => Boolean(n))
}
