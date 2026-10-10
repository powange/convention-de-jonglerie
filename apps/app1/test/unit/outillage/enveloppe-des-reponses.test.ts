import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, it, expect } from 'vitest'

const RACINE_APP = join(process.cwd(), 'server/api')
const RACINE_LAYERS = join(process.cwd(), '..', '..', 'layers')

/**
 * L'enveloppe `{ success, data }` des réponses d'API — constat A8.
 *
 * ## ⚠️ LE DÉFAUT
 *
 * Le projet a une enveloppe — `createSuccessResponse`, `createPaginatedResponse` — et **124
 * handlers sur 574** rendent encore l'objet ou le tableau nu. Le client doit donc deviner, point
 * d'API par point d'API, s'il lit `res` ou `res.data`, et ce doute a déjà produit des appels voués
 * à l'échec dans ce dépôt.
 *
 * ⚠️ LA FICHE RELEVAIT 127 SUR 552 ; recompté, c'est 124 sur 574 après la migration de ce lot.
 * **Le ratio tient, l'écart absolu grandit** : entre la fiche et aujourd'hui, le dépôt a gagné une
 * vingtaine de handlers et plusieurs exceptions. C'est précisément pour cela qu'un relevé ponctuel
 * ne suffit pas.
 *
 * ## ⚠️⚠️ CE TEST EST UN CLIQUET, PAS UNE MESURE DE DETTE
 *
 * Il interdit d'**ajouter** un handler hors enveloppe ; il ne tombera pas le jour où la dette
 * atteindra zéro — un plafond reste satisfait par un compte plus bas. C'est la différence avec une
 * garde qui exigerait un nombre exact : celle-là se casserait à chaque migration, donc on
 * l'abaisserait sans réfléchir, donc elle ne garderait plus rien.
 *
 * Migrer un handler demande de bouger le client EN MÊME TEMPS, et les appelants ne sont pas tous
 * dans ce dépôt. C'est pourquoi la dette se résorbe module par module, et pourquoi ce plafond
 * s'abaisse à la main, à chaque lot qui en migre.
 */

/**
 * Les handlers qui gardent délibérément une réponse nue, avec leur raison.
 *
 * Ils ne comptent pas dans le plafond : les compter rendrait le zéro inatteignable, et un plafond
 * qu'on sait inatteignable finit par ne plus être lu.
 */
const HORS_ENVELOPPE_A_DESSEIN: Record<string, string> = {
  '__sitemap__/carpool.get.ts': 'format imposé par @nuxtjs/sitemap, qui lit un tableau nu',
  '__sitemap__/editions.get.ts': 'format imposé par @nuxtjs/sitemap, qui lit un tableau nu',
  '__sitemap__/volunteers.get.ts': 'format imposé par @nuxtjs/sitemap, qui lit un tableau nu',
  'editions/[id]/export.kml.get.ts': 'rend du XML : une enveloppe JSON n’aurait aucun sens',
  'project-costs/webhook.post.ts': 'appelé par Stripe, qui n’a aucune idée de notre enveloppe',
  'public/editions.get.ts': 'API publique par jeton : des clients hors du dépôt la lisent',
  'public/error-logs.get.ts': 'API publique par jeton, lue par la surveillance externe',
}

/**
 * Le plafond actuel, à abaisser à chaque lot qui migre un module.
 *
 * ⚠️ Ne JAMAIS le relever. Un handler neuf passe par l'enveloppe : c'est une ligne de plus à
 * écrire, pas un chantier.
 */
const PLAFOND = 117

/** Tous les fichiers de handler, application et layers confondus. */
async function handlers(): Promise<string[]> {
  const trouves: string[] = []

  const parcourir = async (chemin: string, prefixe: string) => {
    let entrees
    try {
      entrees = await readdir(chemin, { withFileTypes: true })
    } catch {
      return
    }
    for (const entree of entrees) {
      const complet = join(chemin, entree.name)
      const relatif = prefixe ? `${prefixe}/${entree.name}` : entree.name
      if (entree.isDirectory()) await parcourir(complet, relatif)
      else if (entree.name.endsWith('.ts')) trouves.push(relatif)
    }
  }

  await parcourir(RACINE_APP, '')

  // Les layers ont chacun leur `server/api`, et ils comptent autant que l'application.
  let layers: string[] = []
  try {
    layers = (await readdir(RACINE_LAYERS, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
  } catch {
    layers = []
  }
  for (const layer of layers) {
    await parcourir(join(RACINE_LAYERS, layer, 'server/api'), `layers/${layer}`)
  }

  return trouves
}

/** Le chemin complet d'un handler relevé, pour le lire. */
const cheminDe = (relatif: string) =>
  relatif.startsWith('layers/')
    ? join(RACINE_LAYERS, relatif.slice('layers/'.length).replace('/', '/server/api/'))
    : join(RACINE_APP, relatif)

describe('l’enveloppe des réponses d’API', () => {
  it('⚠️ N’ADMET PAS UN HANDLER HORS ENVELOPPE DE PLUS', async () => {
    const tous = await handlers()

    // Sentinelle : une mesure qui ne lirait rien passerait sans bruit. C'est le compte de FICHIERS
    // LUS qu'on vérifie, et non la dette — celle-ci peut descendre à zéro sans casser le test.
    expect(tous.length, 'aucun handler trouvé : les chemins ont dû changer').toBeGreaterThan(400)

    const horsEnveloppe: string[] = []
    for (const relatif of tous) {
      if (relatif in HORS_ENVELOPPE_A_DESSEIN) continue
      const source = await readFile(cheminDe(relatif), 'utf8')
      if (!/create(Success|Paginated)Response/.test(source)) horsEnveloppe.push(relatif)
    }

    expect(
      horsEnveloppe.length,
      `${horsEnveloppe.length} handlers hors enveloppe, plafond ${PLAFOND}. ` +
        'Un handler neuf doit passer par createSuccessResponse.'
    ).toBeLessThanOrEqual(PLAFOND)
  })

  it('les exceptions portent toutes une raison', () => {
    /*
     * Le garde-fou du garde-fou : une liste d'exceptions sans justification devient le trou par
     * lequel la règle se vide — il suffit d'y ajouter un chemin pour faire taire le test. Exiger
     * une raison non vide ne force pas une bonne raison, mais force à en écrire une.
     */
    for (const [chemin, raison] of Object.entries(HORS_ENVELOPPE_A_DESSEIN)) {
      expect(raison.length, chemin).toBeGreaterThan(20)
    }
  })

  it('⚠️ `/api/countries` EST PASSÉ SOUS ENVELOPPE', async () => {
    /*
     * Le handler migré par ce lot, et le seul dont tous les appelants étaient dans le dépôt — une
     * condition sans laquelle la migration casse l'écran. Ce cas empêche un retour en arrière
     * silencieux : la réponse nue redeviendrait indistinguable d'une absence de données côté client.
     */
    const source = await readFile(join(RACINE_APP, 'countries.get.ts'), 'utf8')

    expect(source).toContain('createSuccessResponse')
    // Et plus aucun `return []` nu, qui donnait une SECONDE forme de réponse au même point d'API.
    expect(source).not.toMatch(/return \[\]\s*$/m)
  })
})
