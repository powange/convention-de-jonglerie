import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, it, expect } from 'vitest'

/**
 * Personne ne doit écrire une URL de connexion à la main.
 *
 * Trois pages d'appel à spectacles construisaient `/login?redirect=…`. Or la page de connexion
 * lit `returnTo`, et **rien dans le dépôt ne lit `redirect`** : le paramètre était mort-né. Une
 * personne à qui on partageait le lien d'un appel cliquait « se connecter », s'identifiait, et
 * atterrissait sur l'accueil. Le défaut a vécu sans être vu parce qu'il n'a l'air de rien : une
 * URL plausible, un paramètre d'apparence raisonnable, et aucune erreur nulle part.
 *
 * `buildLoginUrl` (app/composables/useReturnTo.ts) fait le travail : il nettoie l'URL, refuse de
 * boucler sur une page d'authentification, encode, et emploie le nom que la page lit vraiment.
 *
 * Ce test interdit de le contourner. Il regarde le source, pas le comportement — c'est le seul
 * moyen d'attraper une faute d'orthographe dans un nom de paramètre, qu'aucun test de
 * comportement ne distinguera d'une absence de paramètre.
 */

const RACINE = join(__dirname, '../..')
const DOSSIERS = [join(RACINE, 'app'), join(RACINE, '../../layers')]

/** Le composable a le droit, et lui seul : c'est là que vit la règle. */
const AUTORISES = ['app/composables/useReturnTo.ts']

function fichiersSources(dossier: string): string[] {
  let trouves: string[] = []
  for (const entree of readdirSync(dossier)) {
    if (entree === 'node_modules' || entree === '.nuxt' || entree.startsWith('.')) continue
    const chemin = join(dossier, entree)
    if (statSync(chemin).isDirectory()) trouves = trouves.concat(fichiersSources(chemin))
    else if (/\.(vue|ts)$/.test(entree)) trouves.push(chemin)
  }
  return trouves
}

const sources = DOSSIERS.flatMap(fichiersSources)

/** Une ligne de commentaire, qu'il soit JavaScript, de bloc, ou HTML. */
function estUnCommentaire(ligne: string): boolean {
  const nu = ligne.trim()
  return nu.startsWith('//') || nu.startsWith('*') || nu.startsWith('/*') || nu.startsWith('<!--')
}

describe('liens vers la page de connexion', () => {
  it('trouve bien des fichiers à analyser', () => {
    // Sans cette garde, un chemin cassé rendrait tous les tests suivants verts pour rien.
    expect(sources.length).toBeGreaterThan(200)
  })

  it('n’écrit aucune URL de connexion à la main', () => {
    const fautifs: string[] = []

    for (const chemin of sources) {
      const relatif = relative(RACINE, chemin).replace(/\\/g, '/')
      if (AUTORISES.some((autorise) => relatif.endsWith(autorise))) continue

      const contenu = readFileSync(chemin, 'utf8')
      for (const [index, ligne] of contenu.split('\n').entries()) {
        // Les commentaires sont de la prose : celui qui explique la règle cite forcément
        // l'URL qu'il interdit. Ce test a d'abord signalé son propre commentaire — c'est la
        // même mécanique que les faux positifs de `check-i18n` sur les accents graves.
        if (estUnCommentaire(ligne)) continue

        // Une query collée à /login, quel qu'en soit le nom de paramètre.
        if (/["'`]\/login\?/.test(ligne)) {
          fautifs.push(`${relatif}:${index + 1} — ${ligne.trim().slice(0, 100)}`)
        }
      }
    }

    expect(
      fautifs,
      `Utiliser buildLoginUrl() de useReturnTo plutôt que d'écrire l'URL :\n${fautifs.join('\n')}`
    ).toEqual([])
  })

  it('n’emploie nulle part le paramètre « redirect », que personne ne lit', () => {
    const fautifs: string[] = []

    for (const chemin of sources) {
      const contenu = readFileSync(chemin, 'utf8')
      if (/[?&]redirect=/.test(contenu) || /query\.redirect\b/.test(contenu)) {
        fautifs.push(relative(RACINE, chemin).replace(/\\/g, '/'))
      }
    }

    expect(
      fautifs,
      `Le paramètre lu par la page de connexion est « returnTo » :\n${fautifs.join('\n')}`
    ).toEqual([])
  })
})
