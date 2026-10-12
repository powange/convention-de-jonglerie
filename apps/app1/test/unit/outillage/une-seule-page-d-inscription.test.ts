import fs from 'node:fs'
import path from 'node:path'

import { describe, it, expect } from 'vitest'

/**
 * Une seule page porte le formulaire d'inscription — constat C6.
 *
 * ## Le défaut
 *
 * `/register` était une **seconde** page d'inscription, 411 lignes, avec son propre champ
 * d'adresse et son propre appel à `/api/auth/register`. Et elle n'appelait **pas**
 * `check-email`, contrairement au parcours de `/login` : les deux formulaires ne posaient donc
 * pas les mêmes questions avant de créer un compte.
 *
 * Rien dans l'interface n'y menait, aucun courriel n'y renvoyait, et elle était exclue du
 * sitemap. Elle redirige désormais vers `/login`.
 *
 * ## Ce que cette garde empêche
 *
 * Qu'un **troisième** formulaire apparaisse sans que personne ne compare les deux parcours. Le
 * jour où c'est voulu, ce test tombe et demande de le déclarer ici — ce qui est tout l'objet :
 * la divergence des deux formulaires n'a jamais été décidée, elle a été constatée des mois plus
 * tard.
 */
const RACINE = path.resolve(__dirname, '../../../../..')

/** Les pages (et composants de page) qui appellent le point d'API d'inscription. */
function pagesQuiInscrivent(): { lus: number; pages: string[] } {
  const racines = [
    path.resolve(RACINE, 'apps/app1/app'),
    ...fs
      .readdirSync(path.resolve(RACINE, 'layers'), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => path.resolve(RACINE, 'layers', e.name, 'app')),
  ]

  let lus = 0
  const pages: string[] = []

  const parcours = (dossier: string) => {
    if (!fs.existsSync(dossier)) return
    for (const entree of fs.readdirSync(dossier, { withFileTypes: true })) {
      const complet = path.join(dossier, entree.name)
      if (entree.isDirectory()) {
        parcours(complet)
        continue
      }
      if (!entree.name.endsWith('.vue')) continue
      lus++
      const src = fs.readFileSync(complet, 'utf8')
      if (src.includes("'/api/auth/register'")) {
        pages.push(path.relative(RACINE, complet).split(path.sep).join('/'))
      }
    }
  }
  racines.forEach(parcours)
  return { lus, pages }
}

describe('le formulaire d’inscription', () => {
  it('⚠️ N’EXISTE QU’À UN SEUL ENDROIT', () => {
    expect(
      pagesQuiInscrivent().pages,
      'deux écrans créeraient des comptes par des chemins différents, et rien ne garantirait ' +
        'qu’ils posent les mêmes questions — le défaut C6, où le second n’appelait pas ' +
        '`check-email`'
    ).toEqual(['layers/auth/app/pages/login/index.vue'])
  })

  it('⚠️ /register REDIRIGE, et ne rend plus de formulaire', () => {
    /*
     * La page est conservée — et non supprimée — pour que les adresses déjà en circulation
     * mènent quelque part. `redirect` dans `definePageMeta` vaut pour le rendu serveur ET pour
     * une navigation interne, là où une règle de route Nitro ne couvrirait que le premier.
     */
    const src = fs.readFileSync(
      path.resolve(RACINE, 'layers/auth/app/pages/register/index.vue'),
      'utf8'
    )

    expect(src).toContain("redirect: '/login'")
    /*
     * 📍 On n'assère PAS l'absence de la chaîne « /api/auth/register » : la documentation de la
     * page la cite pour expliquer ce qu'elle faisait, et le test tombait sur son propre
     * commentaire. Ce qui compte est qu'elle n'APPELLE plus rien et ne SAISISSE plus rien.
     */
    expect(src).not.toContain('$fetch(')
    expect(src).not.toContain('useApiAction(')
    expect(src).not.toContain('<UInput')
    expect(src).not.toContain('<UForm')
  })

  it('le balayage lit bien des pages — il ne conclut pas sur le vide', () => {
    // Le premier cas compare à une liste d'un élément : une erreur de chemin rendrait `[]` et le
    // ferait tomber, mais sur un message parlant du formulaire plutôt que du balayage.
    expect(pagesQuiInscrivent().lus).toBeGreaterThan(200)
  })
})
