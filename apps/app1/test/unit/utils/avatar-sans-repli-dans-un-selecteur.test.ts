import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * `getUserAvatar` ne doit JAMAIS alimenter directement la prop `avatar` d'un composant Nuxt UI.
 *
 * ⚠️ CE QUI EST PIÉGEUX. `getUserAvatar` rend, pour qui n'a pas de photo de profil, une URL
 * Gravatar terminée par `d=404` — introuvable VOLONTAIREMENT. Ce n'est pas un défaut : c'est le
 * signal que guette `getUserAvatarWithCache`, qui retombe alors sur les initiales dessinées sur
 * une couleur calculée depuis le pseudo. Seul `UiUserAvatar` appelle cette seconde fonction.
 *
 * Passer l'URL brute à `avatar: { src: … }` court-circuite donc tout le repli : Nuxt UI reçoit
 * une image qui échoue et affiche SON propre substitut, gris et identique pour tout le monde.
 * Deux sélecteurs des tâches étaient dans ce cas, et le symptôme ne ressemble pas à une panne —
 * les avatars s'affichent, simplement « pas de la bonne couleur ». C'est ainsi que l'utilisateur
 * l'a décrit, et c'est pourquoi le défaut a vécu si longtemps.
 *
 * 📍 La forme `avatar.src = getUserAvatar(…)` suivie d'un `onerror` reste légitime — c'est ce que
 * fait le planning du stock, qui construit son image à la main et traite l'échec. La garde ne vise
 * que la forme objet, celle qu'on passe à Nuxt UI sans pouvoir y accrocher de repli.
 */

const RACINES = ['layers', 'apps/app1/app']
const DEPOT = join(import.meta.dirname, '../../../../..')

function fichiersVue(): string[] {
  const trouves: string[] = []

  const parcourir = (dossier: string) => {
    for (const entree of readdirSync(dossier)) {
      if (entree === 'node_modules' || entree === '.nuxt') continue
      const chemin = join(dossier, entree)
      if (statSync(chemin).isDirectory()) parcourir(chemin)
      else if (entree.endsWith('.vue')) trouves.push(chemin)
    }
  }

  for (const racine of RACINES) parcourir(join(DEPOT, racine))
  return trouves
}

/**
 * Retirer les commentaires avant de chercher.
 *
 * ⚠️ SANS CELA, LA GARDE MORD SUR SON PROPRE AVERTISSEMENT : les deux corrections d'origine
 * portent un commentaire qui CITE la forme fautive pour expliquer pourquoi il faut l'éviter. La
 * garde est tombée là-dessus au premier passage. Le même piège a déjà coûté six passages à
 * l'outillage i18n, pour la même raison : un motif cité dans une explication n'est pas du code.
 */
function sansCommentaires(source: string): string {
  return source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')
}

/** `avatar: { … getUserAvatar(…) … }` — la forme objet, sur une seule ligne comme à cheval. */
const AVATAR_SANS_REPLI = /avatar\s*:\s*\{[^}]*getUserAvatar\s*\(/s

describe('getUserAvatar et la prop avatar de Nuxt UI', () => {
  it('ne se rencontrent dans aucun composant', () => {
    const fautifs = fichiersVue()
      .filter((chemin) => AVATAR_SANS_REPLI.test(sansCommentaires(readFileSync(chemin, 'utf8'))))
      .map((chemin) => chemin.slice(DEPOT.length + 1))

    expect(fautifs).toEqual([])
  })

  it('balaie bien un dépôt non vide', () => {
    // Sans cette seconde attente, un parcours qui ne trouverait aucun `.vue` rendrait la première
    // verte sans rien avoir lu. Le cas s'est déjà produit en changeant la racine du dépôt.
    expect(fichiersVue().length).toBeGreaterThan(200)
  })
})
