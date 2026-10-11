import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, it, expect } from 'vitest'

const RACINE = process.cwd()
const DEPOT = join(RACINE, '..', '..')
const HELPERS = join(RACINE, 'server', 'utils', 'prisma-select-helpers.ts')
const DOC_HELPERS = join(DEPOT, 'docs', 'prisma-select-helpers.md')
const README = join(DEPOT, 'README.md')
const WORKFLOWS = join(DEPOT, '.github', 'workflows')

/**
 * Les documents décrivent-ils encore le dépôt ? — constat A4.
 *
 * ## Ce qui était faux, vérifié document par document
 *
 * - le **badge CI** du README pointait `workflows/test.yml` ; le fichier s'appelle `tests.yml`
 *   (badge cassé, affiché en haut de la page d'accueil du dépôt) ;
 * - `README.tests.md` annonçait `setup-mocks.ts` pour le projet `unit` et `setup-integration.ts`
 *   pour l'intégration. Ces deux fichiers **existaient** mais n'étaient référencés nulle part —
 *   211 lignes mortes — et `setupFiles` n'est déclaré que pour le projet `nuxt` ;
 * - `SCRIPTS.md` documentait `scripts/migrate-organizer-rights.ts`, absent, avec `npx ts-node`
 *   alors que ce dépôt utilise `tsx` ;
 * - ⚠️ `docs/docker/DOCKER.md` présentait `docker-compose.release.yml` comme « la production » et
 *   ne mentionnait **jamais** `docker-compose.prod.yml`, qui existe et sert un autre
 *   environnement, sur un autre port. **C'est le plus grave, et la fiche ne le relevait pas** : s'y
 *   fier conduisait à déployer sur la pré-production en croyant toucher la production ;
 * - `docs/prisma-select-helpers.md` — que le `CLAUDE.md` désigne comme « la liste complète » — ne
 *   listait que **20 des 44** helpers exportés.
 *
 * ## ⚠️ DEUX POINTS DE LA FICHE ÉTAIENT FAUX
 *
 * Elle reprochait au document des helpers de citer `userWithEmailSelect`, « qui n'existe pas ».
 * C'est un **exemple pédagogique**, dans la section « créer de nouveaux helpers si pattern
 * récurrent », introduit par « ajoutez-la au fichier » : il n'affirme rien. Même chose pour
 * `UserSelect`, qui est le type `Prisma.UserSelect`. Et le port 3307 qu'elle signalait dans
 * `DOCKER.md` y est en réalité correctement expliqué — c'est 3310 qui est documenté pour les
 * tests, 3307 étant noté comme pris par un autre projet.
 *
 * ## Ce que ce test garde
 *
 * Les deux écarts qui se reforment tout seuls : un helper ajouté sans entrer dans la liste, et un
 * badge qui pointe un workflow renommé. Le reste — un script supprimé, un compose confondu avec un
 * autre — ne se reproduit pas sans qu'on touche au document, et une garde par chaîne de caractères
 * y serait du bruit.
 */
const existe = async (chemin: string) =>
  access(chemin)
    .then(() => true)
    .catch(() => false)

describe('les documents décrivent le dépôt réel', () => {
  it('⚠️ LES 44 HELPERS PRISMA SONT TOUS DANS LA LISTE', async () => {
    /*
     * Le `CLAUDE.md` renvoie à ce document comme à « la liste complète », et les agents l'ouvrent
     * pour savoir quel helper réutiliser. Vingt-quatre absents, c'est vingt-quatre sélections
     * qu'on réécrit à la main faute de les connaître — exactement ce que ces helpers existent
     * pour éviter.
     *
     * ⚠️ On ne lit QUE la section « Helpers disponibles » : le reste du document contient des
     * exemples pédagogiques qui définissent des helpers imaginaires, et les compter ferait passer
     * la liste pour complète alors qu'elle ne l'est pas.
     */
    const code = await readFile(HELPERS, 'utf8')
    const doc = await readFile(DOC_HELPERS, 'utf8')

    const debut = doc.indexOf('## 🔧 Helpers disponibles')
    const fin = doc.indexOf('## 📖 Guide')
    expect(debut, 'la section « Helpers disponibles » a disparu du document').toBeGreaterThan(-1)
    expect(fin).toBeGreaterThan(debut)
    const liste = doc.slice(debut, fin)

    const exportes = [...code.matchAll(/export const (\w+)/g)].map((m) => m[1]!)
    expect(exportes.length, 'aucun helper exporté : le balayage est cassé').toBeGreaterThan(30)

    const cites = new Set([...liste.matchAll(/\b(\w+(?:Select|Include))\b/g)].map((m) => m[1]!))
    const absents = exportes.filter((n) => !cites.has(n))

    expect(
      absents,
      `Ces helpers sont exportés mais absents de la liste, que le CLAUDE.md présente comme ` +
        `complète :\n${absents.join('\n')}`
    ).toEqual([])
  })

  it('⚠️ LE BADGE DU README POINTE UN WORKFLOW QUI EXISTE', async () => {
    /*
     * Il s'affiche en haut de la page d'accueil du dépôt, et un badge cassé y reste visible
     * indéfiniment sans que rien ne le signale. Il pointait `test.yml` quand le fichier s'appelle
     * `tests.yml`.
     */
    const readme = await readFile(README, 'utf8')
    const cites = [...readme.matchAll(/actions\/workflows\/([\w.-]+\.yml)/g)].map((m) => m[1]!)

    expect(cites.length, 'plus aucun badge de workflow : ce cas peut être retiré').toBeGreaterThan(
      0
    )

    const introuvables: string[] = []
    for (const nom of cites) {
      if (!(await existe(join(WORKFLOWS, nom)))) introuvables.push(nom)
    }
    expect(
      introuvables,
      `Le README pointe des workflows inexistants — le badge reste cassé en silence :\n${introuvables.join('\n')}`
    ).toEqual([])
  })
})
