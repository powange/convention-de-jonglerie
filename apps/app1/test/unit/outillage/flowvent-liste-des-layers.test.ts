import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Les layers que Flowvent (app2) étend sont recopiés à la main en CINQ endroits :
 *
 *   apps/app2/nuxt.config.ts                     `extends` — la source
 *   apps/app2/Dockerfile                         `COPY layers/<x>/` — ce qui entre dans l'image
 *   apps/app2/Dockerfile.dockerignore            `!layers/<x>` — ce que le contexte laisse passer
 *   apps/app2/docker-compose.dev.yml             les montages du conteneur de dev
 *   .github/workflows/publier-image-flowvent.yml le filtre `push` (publication sur main)
 *
 * Chaque oubli a son symptôme, et aucun n'est bruyant au bon moment :
 *  - absent du Dockerfile ou du dockerignore → l'image ne se construit plus, découvert à la
 *    publication sur `main` ;
 *  - absent des montages → le serveur de dev ne démarre plus, découvert par le premier qui le lance ;
 *  - absent du filtre du workflow → un merge qui touche ce layer ne republie pas l'image.
 *
 * La garde des PR (job `image-flowvent` de tests.yml) n'a PAS de copie : `perimetre-ci.mjs` lit
 * `extends` à chaque run. C'était la copie la plus dangereuse — absente, une PR qui cassait
 * Flowvent par ce layer ne le reconstruisait pas, et passait au vert.
 *
 * `layers/map` a été ajouté après coup, fichier par fichier : c'est exactement cette dérive.
 *
 * ⚠️ Les fichiers sont LUS COMME DU TEXTE, comme dans les autres tests `flowvent-*` : la CI ne
 * prépare qu'app1, un import d'un fichier d'app2 y échouerait.
 */
const DEPOT = resolve(process.cwd(), '..', '..')
const lire = (chemin: string) => readFileSync(join(DEPOT, chemin), 'utf8')
const ensemble = (src: string, motif: RegExp) =>
  [...new Set([...src.matchAll(motif)].map((m) => m[1]!))].sort()

/** Le bloc d'un déclencheur du workflow : de `  <nom>:` à la clé suivante de même niveau. */
const declencheur = (src: string, nom: string) => {
  const debut = src.search(new RegExp(`^ {2}${nom}:$`, 'm'))
  if (debut < 0) return ''
  const suite = src.slice(debut + 1).search(/^ {2}\S/m)
  return src.slice(debut, suite < 0 ? undefined : debut + 1 + suite)
}

describe('Flowvent — la liste des layers est la même partout', () => {
  const extendsBloc = lire('apps/app2/nuxt.config.ts').match(/extends:\s*\[([^\]]*)\]/)?.[1] ?? ''
  const source = ensemble(extendsBloc, /'\.\.\/\.\.\/layers\/([a-z0-9-]+)'/g)

  const workflow = lire('.github/workflows/publier-image-flowvent.yml')
  const copies: Record<string, string[]> = {
    'apps/app2/Dockerfile': ensemble(
      lire('apps/app2/Dockerfile'),
      /^COPY layers\/([a-z0-9-]+)\//gm
    ),
    'apps/app2/Dockerfile.dockerignore': ensemble(
      lire('apps/app2/Dockerfile.dockerignore'),
      /^!layers\/([a-z0-9-]+)\s*$/gm
    ),
    'apps/app2/docker-compose.dev.yml': ensemble(
      lire('apps/app2/docker-compose.dev.yml'),
      /^\s*- \.\.\/\.\.\/layers\/([a-z0-9-]+):\/app\/layers\//gm
    ),
    'publier-image-flowvent.yml (push)': ensemble(
      declencheur(workflow, 'push'),
      /- 'layers\/([a-z0-9-]+)\/\*\*'/g
    ),
  }

  it('la source est lue — le test ne conclut pas sur une liste vide', () => {
    // auth et core sont étendus depuis l'origine de Flowvent ; s'ils manquent, c'est la lecture
    // qui est cassée, pas la configuration.
    expect(source).toEqual(expect.arrayContaining(['auth', 'core']))
  })

  for (const [fichier, liste] of Object.entries(copies)) {
    it(`⚠️ ${fichier} reprend exactement les layers de \`extends\``, () => {
      const manquants = source.filter((l) => !liste.includes(l))
      const enTrop = liste.filter((l) => !source.includes(l))
      expect(
        { manquants, enTrop },
        `${fichier} : layers absents ${JSON.stringify(manquants)}, en trop ${JSON.stringify(enTrop)} ` +
          `par rapport à \`extends\` dans apps/app2/nuxt.config.ts`
      ).toEqual({ manquants: [], enTrop: [] })
    })
  }

  it('⚠️ la doc et le skill de déploiement renvoient à `extends` au lieu d’énumérer les layers', () => {
    // Une sixième copie, dans /deploy-flowvent, citait 4 layers quand Flowvent en étendait 7 : elle
    // ne décidait de rien, mais faisait croire qu'un merge sur layers/stock ne republiait pas
    // l'image. Une liste recopiée dans un texte se périme comme une autre.
    for (const chemin of [
      '.claude/skills/deploy-flowvent/SKILL.md',
      'docs/deploiement-flowvent.md',
    ]) {
      const texte = lire(chemin)
      expect(texte, chemin).not.toMatch(/`layers\/[a-z0-9-]+\/\*\*`/)
      expect(texte, chemin).toContain('extends')
    }
  })
})
