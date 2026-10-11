import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, it, expect } from 'vitest'

const RACINE = process.cwd()
const DEPOT = join(RACINE, '..', '..')
const CLAUDE_MD = join(DEPOT, 'CLAUDE.md')
const PACKAGE = join(RACINE, 'package.json')

/**
 * Le `CLAUDE.md` annonce-t-il la bonne génération d'outils ? — constat A5.
 *
 * ## ⚠️ Le défaut
 *
 * Il annonçait **dix-neuf versions exactes, dont dix-sept fausses** — et six d'une **majeure
 * entière** : Prisma 6 quand le projet est en 7, Vitest 3 en 4, ESLint 9 en 10, VueUse 13 en 14,
 * Nuxt Image 1 en 2, Nuxt Test Utils 3 en 4. Ce document est lu à chaque session : annoncer la
 * mauvaise majeure envoie chercher l'API d'une autre génération d'outil, et Prisma 7 n'est pas un
 * changement de numéro mais de modèle (`@prisma/adapter-mariadb`, `prisma.config.ts`).
 *
 * ## Pourquoi les numéros précis ont été retirés plutôt que corrigés
 *
 * Un document qui recopie une information versionnée ailleurs sera **toujours** en retard : il
 * redevient faux au premier `npm update`, et une garde sur les numéros exacts ferait rougir la CI
 * à chaque mise à jour de correctif, pour rien. Seules les **majeures** restent dans le document,
 * parce qu'elles seules changent l'API ; le détail est dans `package.json`, qui ne peut pas se
 * périmer.
 *
 * Ce test ne garde donc que les majeures — c'est-à-dire exactement ce qui rend le document
 * trompeur quand il dérive.
 *
 * ## 📍 UN POINT DE LA FICHE ÉTAIT FAUX
 *
 * Elle affirmait que « la consigne de la mémoire *ne pas retirer l'override vite ^8* est
 * caduque ». La note de mémoire dit **déjà**, et depuis le 22/07/2026, que cet override n'existe
 * plus. Elle était à jour ; c'est la fiche qui l'a crue périmée.
 */

/** Le paquet npm derrière chaque nom affiché dans le document. */
const MAJEURES_ATTENDUES: Record<string, string> = {
  Nuxt: 'nuxt',
  'Nuxt UI': '@nuxt/ui',
  Pinia: 'pinia',
  TypeScript: 'typescript',
  'Nuxt i18n': '@nuxtjs/i18n',
  VueUse: '@vueuse/nuxt',
  Prisma: 'prisma',
  bcryptjs: 'bcryptjs',
  'Chart.js': 'chart.js',
  FullCalendar: '@fullcalendar/core',
  ESLint: 'eslint',
  Vitest: 'vitest',
  'Nuxt Test Utils': '@nuxt/test-utils',
  'Nuxt Image': '@nuxt/image',
  Prettier: 'prettier',
}

describe('versions annoncées dans CLAUDE.md', () => {
  it('⚠️ LES MAJEURES ANNONCÉES SONT CELLES QUI SONT INSTALLÉES', async () => {
    const md = await readFile(CLAUDE_MD, 'utf8')
    const pkg = JSON.parse(await readFile(PACKAGE, 'utf8'))
    const deps: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies }

    const ecarts: string[] = []
    for (const [affiche, paquet] of Object.entries(MAJEURES_ATTENDUES)) {
      const declare = deps[paquet]
      expect(
        declare,
        `${paquet} a disparu du package.json : mettre à jour cette table`
      ).toBeDefined()

      const majeureReelle = declare!.replace(/^[\^~]/, '').split('.')[0]!
      /*
       * On cherche « Nom **N** » dans le document, la majeure en gras. Le `[^*]{0,40}?` tolère ce
       * qui sépare le nom du numéro (« Nuxt i18n **10** », « nuxt-auth-utils **0.5** »), sans
       * franchir une autre mise en gras.
       */
      const motif = new RegExp(
        `${affiche.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}[^*]{0,40}?\\*\\*([\\d.]+)\\*\\*`
      )
      const annonce = md.match(motif)?.[1]

      if (!annonce) ecarts.push(`${affiche} : plus annoncé dans CLAUDE.md (installé : ${declare})`)
      else if (annonce.split('.')[0] !== majeureReelle) {
        ecarts.push(`${affiche} : annoncé ${annonce}, installé ${declare}`)
      }
    }

    expect(
      ecarts,
      `Le CLAUDE.md est lu à chaque session : une majeure fausse envoie chercher l'API d'une autre ` +
        `génération d'outil.\n${ecarts.join('\n')}`
    ).toEqual([])
  })

  it('⚠️ AUCUN NUMÉRO DE CORRECTIF N’EST RÉINTRODUIT', async () => {
    /*
     * LA CAUSE. Le premier cas serait satisfait par un document qui annonce de nouveau
     * « Prisma v7.9.0 » — juste aujourd'hui, faux au prochain `npm update`. Ce qu'il faut garder,
     * c'est que le document ne prétende plus à une précision qu'il ne peut pas tenir.
     *
     * ⚠️ On ne regarde que le bloc des technologies : le reste du document cite légitimement des
     * versions précises (une note sur Nuxt 4.5.2, un numéro de PR), et les interdire partout
     * rendrait ce cas ingouvernable.
     */
    const md = await readFile(CLAUDE_MD, 'utf8')
    const debut = md.indexOf('**Technologies :**')
    const fin = md.indexOf('**Architecture (monorepo) :**')
    expect(debut, 'le bloc des technologies a disparu').toBeGreaterThan(-1)
    expect(fin).toBeGreaterThan(debut)

    const bloc = md.slice(debut, fin)
    const precises = [...bloc.matchAll(/\bv?\d+\.\d+\.\d+\b/g)].map((m) => m[0])

    expect(
      precises.filter((v) => v !== '3.5.38'), // la seule exception : la version fixée par `overrides`
      `Ce bloc annonce des versions de correctif, qui seront fausses au prochain \`npm update\`. ` +
        `N'y mettre que les MAJEURES et renvoyer à package.json :\n${precises.join(', ')}`
    ).toEqual([])
  })

  it('⚠️ AUCUN SCRIPT NE POINTE UN CHEMIN ABSOLU D’UNE AUTRE MACHINE', async () => {
    /*
     * `jcodemunch:watch` pointait `/root/projets/convention-de-jonglerie` — un chemin qui n'existe
     * sur aucune machine de travail de ce dépôt. La commande échouait donc silencieusement pour
     * qui la lançait, et rien dans son nom ne le laissait deviner. Remplacé par `../..`, relatif à
     * la racine, donc valable partout.
     */
    const pkg = JSON.parse(await readFile(PACKAGE, 'utf8'))
    const scripts: Record<string, string> = pkg.scripts ?? {}

    const fautifs = Object.entries(scripts)
      .filter(([, cmd]) => /(^|[\s='"])\/(root|home|Users)\//.test(cmd))
      .map(([nom, cmd]) => `${nom} : ${cmd.slice(0, 80)}`)

    expect(
      fautifs,
      `Un chemin absolu vers un répertoire personnel ne vaut que sur une machine. Utiliser un ` +
        `chemin relatif :\n${fautifs.join('\n')}`
    ).toEqual([])
  })
})
