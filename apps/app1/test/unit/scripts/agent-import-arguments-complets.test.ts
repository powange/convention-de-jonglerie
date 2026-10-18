import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

/**
 * Tout appel à `fetchAndExtractContent` passe `facebookData` ET `signal`.
 *
 * ## Pourquoi cette garde existe
 *
 * Cette fonction prend huit paramètres, dont les deux derniers sont optionnels :
 *
 *     fetchAndExtractContent(url, taskId, visitedUrls, logs, maxPageContentSize,
 *                            browserlessUrl, facebookData?, signal?)
 *
 * Trois appels existent. Deux passaient les huit ; le troisième — celui du parcours où l'AGENT
 * réclame lui-même une page, par `FETCH_URL` — n'en passait que sept, et `signal` atterrissait
 * donc dans l'emplacement de `facebookData`. Deux conséquences, toutes deux muettes :
 *
 * 1. **l'annulation ne parvenait pas à ces requêtes.** L'en-tête du paramètre `signal` le dit
 *    déjà de lui-même : « c'est précisément ce qui fait qu'une annulation "branchée" ne l'est
 *    pas ». Le client fermait le tuyau, l'agent continuait d'aller chercher des pages ;
 * 2. **un `prefilledJson` extrait sur ce parcours était perdu.** `fetchAndExtractContent` écrit
 *    `facebookData.prefilledJson` sur l'objet reçu ; reçu un `AbortSignal`, il l'écrivait là.
 *    Or cet objet est relu plus bas pour être injecté dans le prompt — un événement Facebook ou
 *    JugglingEdge exploré par ce chemin n'y arrivait jamais.
 *
 * Le compilateur le voyait (TS2345), mais la porte de typage était éteinte à ce moment-là
 * (#859). Deux arguments positionnels de types sans rapport, et rien à l'écran : c'est
 * exactement le genre de défaut qu'une relecture ne rattrape pas.
 *
 * ## Ce qu'elle vérifie
 *
 * Les arguments sont comptés par POSITION dans le texte de l'appel, et non ligne par ligne :
 * un appel écrit sur une seule ligne doit crier comme un appel écrit sur huit.
 *
 * ⚠️ Elle ne contrôle pas les six premiers arguments. Leur type les protège déjà — ce sont des
 * chaînes, des tableaux et un nombre, qu'une permutation ferait échouer au typage de façon
 * visible. Les deux derniers sont précisément ceux que leur optionalité rendait silencieux.
 */
const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const SOURCE = join(RACINE, 'server/api/admin/generate-import-json-agent.post.ts')

const source = readFileSync(SOURCE, 'utf8')

const FONCTION = 'fetchAndExtractContent('

/** Les arguments de chaque APPEL, dans l'ordre — la déclaration étant écartée. */
const appels = (): { ligne: number; args: string[] }[] => {
  const trouves: { ligne: number; args: string[] }[] = []

  for (let i = source.indexOf(FONCTION); i !== -1; i = source.indexOf(FONCTION, i + 1)) {
    // La déclaration n'est pas un appel : elle décrit les paramètres, pas ce qu'on leur passe.
    const avant = source.slice(Math.max(0, i - 20), i)
    if (avant.includes('function ')) continue

    // Comptage des parenthèses : un argument peut lui-même être un appel.
    let profondeur = 1
    let j = i + FONCTION.length
    for (; j < source.length && profondeur > 0; j++) {
      if (source[j] === '(') profondeur++
      else if (source[j] === ')') profondeur--
    }
    const corps = source.slice(i + FONCTION.length, j - 1)

    // Découpage sur les virgules de PREMIER niveau seulement.
    const args: string[] = []
    let courant = ''
    let p = 0
    for (const c of corps) {
      if (c === '(' || c === '[' || c === '{') p++
      else if (c === ')' || c === ']' || c === '}') p--
      if (c === ',' && p === 0) {
        args.push(courant.trim())
        courant = ''
      } else courant += c
    }
    if (courant.trim()) args.push(courant.trim())

    trouves.push({
      ligne: source.slice(0, i).split('\n').length,
      // Les commentaires de bloc glissés entre les arguments ne sont pas des arguments.
      args: args.map((a) => a.replace(/\/\*[\s\S]*?\*\//g, '').trim()).filter((a) => a.length > 0),
    })
  }

  return trouves
}

describe('Agent d’import : les appels passent tous leurs arguments', () => {
  const trouves = appels()

  it('le témoin : les appels sont bien LUS, et la déclaration écartée', () => {
    /*
     * Sans ce cas, toutes les assertions ci-dessous seraient vertes sur une liste vide — le
     * défaut classique d'une garde dont le chemin ou l'ancre a glissé. Le seuil est bas et
     * stable : trois appels existent, et un quatrième ne doit pas faire crier la garde.
     */
    expect(trouves.length, `aucun appel trouvé dans ${SOURCE}`).toBeGreaterThan(2)

    // Et chacun porte bien des arguments : un découpage cassé rendrait des listes vides.
    for (const { ligne, args } of trouves) {
      expect(args.length, `appel de la ligne ${ligne} lu sans argument`).toBeGreaterThan(5)
    }
  })

  it('⚠️ chacun passe `facebookData` puis `signal`, dans cet ordre', () => {
    const fautifs = trouves
      .filter(({ args }) => args[6] !== 'facebookData' || args[7] !== 'signal')
      .map(
        ({ ligne, args }) => `ligne ${ligne} — ${args.length} argument(s) : [${args.join(', ')}]`
      )

    expect(
      fautifs,
      `ces appels à \`fetchAndExtractContent\` ne passent pas \`facebookData\` en 7e position\n` +
        `et \`signal\` en 8e. Les deux étant optionnels, un oubli décale silencieusement le\n` +
        `second dans l'emplacement du premier : l'annulation ne parvient plus à la requête, et\n` +
        `le JSON pré-rempli est écrit sur l'objet reçu à tort.\n` +
        fautifs.join('\n')
    ).toEqual([])
  })

  it('📍 et aucun n’en passe plus de huit', () => {
    // L'autre sens : un argument ajouté sans mettre la signature à jour serait ignoré.
    const trop = trouves
      .filter(({ args }) => args.length > 8)
      .map(({ ligne, args }) => `ligne ${ligne} — ${args.length} arguments`)

    expect(
      trop,
      `appels avec plus d'arguments que la signature n'en déclare :\n${trop.join('\n')}`
    ).toEqual([])
  })
})
