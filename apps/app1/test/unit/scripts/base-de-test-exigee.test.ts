import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * La barrière qui empêche les tests d'intégration de vider la base de DÉVELOPPEMENT.
 *
 * ⚠️⚠️ CE N'EST PAS UNE PRÉCAUTION THÉORIQUE : c'est arrivé, par deux chemins différents.
 *
 * `test/setup-db.ts` appelle `cleanDatabase()`, qui supprime utilisateurs, conventions, éditions,
 * covoiturage, publications et bénévoles de la base que l'environnement désigne — et il ne
 * vérifiait pas LAQUELLE. Un `DATABASE_URL` hérité du `.env` de développement suffisait donc.
 *
 * • Chemin 1, depuis le conteneur de dev : `TEST_WITH_DB=true` y voit `DATABASE_URL` = la base de
 *   travail.
 * • Chemin 2, depuis l'hôte, avec les commandes DOCUMENTÉES `npm run test:setup` et
 *   `npm run test:db:run` : `docker-compose.test.yml` partageait son `name:`, son
 *   `container_name:` et son volume `mysql_data` avec le fichier de développement. Compose
 *   attachait donc le volume de dev, puis `cleanDatabase` le vidait.
 *
 * ⚠️ POURQUOI UN TEST QUI LIT LES FICHIERS, et pas un test de comportement. La garde vit dans
 * `setup-db.ts`, qui est le fichier de SETUP du projet `integration` : l'importer depuis un test
 * unitaire installerait ses crochets `beforeAll`/`afterAll` et tenterait une connexion. Ce qu'on
 * veut tenir est la CONFIGURATION — les identités Compose séparées, les ports distincts, la
 * présence de la garde —, et elle se lit.
 */

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const lire = (chemin: string) => readFileSync(join(RACINE, chemin), 'utf8')

/**
 * Les URL de connexion écrites en littéral dans un fichier.
 *
 * 📍 On ne cherche PAS la chaîne dans tout le fichier : mes premières assertions tombaient sur mes
 * propres commentaires, qui citent l'ancienne valeur fautive pour expliquer le défaut. Un test qui
 * interdit de DOCUMENTER un défaut est un mauvais test — ce qui compte est ce que le code emploie.
 */
const urlsEnDur = (contenu: string) =>
  [...contenu.matchAll(/'(mysql:\/\/[^']+)'/g)].map((m) => m[1] ?? '')

describe('les fichiers compose de dev et de test ne se recouvrent plus', () => {
  const dev = lire('docker-compose.dev.yml')
  const test = lire('docker-compose.test.yml')

  const nomDeProjet = (contenu: string) => contenu.match(/^name:\s*(\S+)/m)?.[1]
  const conteneurs = (contenu: string) =>
    [...contenu.matchAll(/container_name:\s*(\S+)/g)].map((m) => m[1])
  const ports = (contenu: string) => [...contenu.matchAll(/'(\d+):\d+'/g)].map((m) => Number(m[1]))

  it('🔬 portent des noms de projet DIFFÉRENTS', () => {
    /*
     * L'assertion la plus importante du fichier : c'est le `name:` qui PRÉFIXE les volumes. Avec le
     * même nom des deux côtés, `mysql_data` résolvait `convention-de-jonglerie_mysql_data`,
     * c'est-à-dire la base de développement — et tout le reste en découlait.
     */
    expect(nomDeProjet(dev)).toBeTruthy()
    expect(nomDeProjet(test)).toBeTruthy()
    expect(nomDeProjet(test)).not.toBe(nomDeProjet(dev))
  })

  it('🔬 ne partagent AUCUN nom de conteneur', () => {
    // Un `container_name` commun fait RECRÉER le conteneur de dev avec la configuration de test,
    // port compris : la pile de développement se retrouve cassée en plus d'être vidée.
    const communs = conteneurs(test).filter((n) => conteneurs(dev).includes(n))
    expect(communs, `conteneurs partagés : ${communs.join(', ')}`).toEqual([])
  })

  it('🔬 ne partagent AUCUN port publié', () => {
    /*
     * 3306 est la base de dev, 3308 sa base miroir, et 3307 est pris par un autre projet de cette
     * machine (voir le commentaire de `shadow-db`). Le fichier de test publiait 3308 : il entrait
     * donc en conflit avec la base miroir, en plus du reste.
     */
    const communs = ports(test).filter((p) => ports(dev).includes(p))
    expect(communs, `ports partagés : ${communs.join(', ')}`).toEqual([])
  })

  it('n’attache aucun volume nommé pour sa base', () => {
    // La base de test est jetable : `tmpfs` plutôt qu'un volume nommé. Rien de persistant ne peut
    // alors être confondu avec le développement, et les migrations s'y rejouent en quelques
    // secondes au lieu de quelques minutes.
    expect(test).toContain('tmpfs')
    expect(test).not.toMatch(/^\s+- mysql_data:/m)
  })

  it('nomme sa base avec « test »', () => {
    // Ce qui fait passer la garde de `setup-db.ts` — et sans quoi les tests refuseraient de partir.
    expect(test).toMatch(/MYSQL_TEST_DATABASE:-convention_db_test/)
  })
})

/**
 * Les CINQ fichiers compose de test, et pas seulement celui des tests d'intégration.
 *
 * ⚠️ DÉFAUT DE LA MÊME FAMILLE, absent du constat d'origine : les quatre autres portaient eux aussi
 * `name: convention-de-jonglerie` ET déclaraient un volume `node_modules`. Ils résolvaient donc
 * `convention-de-jonglerie_node_modules`, c'est-à-dire L'INSTALLATION DU CONTENEUR DE
 * DÉVELOPPEMENT — que les scripts `docker:test:*:clean` (`down -v`) auraient supprimée. Le nom de
 * projet partagé est la cause unique des deux dégâts.
 */
describe('aucun compose de test ne partage l’identité du développement', () => {
  const FICHIERS = [
    'docker-compose.test.yml',
    'docker-compose.test-all.yml',
    'docker-compose.test-simple.yml',
    'docker-compose.test-ui.yml',
    'docker-compose.test-integration.yml',
  ]
  const nomDuDev = lire('docker-compose.dev.yml').match(/^name:\s*(\S+)/m)?.[1]

  it('le fichier de développement porte bien un nom de projet', () => {
    // Sans lui, Compose déduirait le nom du dossier et la comparaison ci-dessous ne vaudrait rien.
    expect(nomDuDev).toBe('convention-de-jonglerie')
  })

  it.each(FICHIERS)('🔬 %s porte un nom de projet distinct', (fichier) => {
    const nom = lire(fichier).match(/^name:\s*(\S+)/m)?.[1]
    expect(nom, `${fichier} n'a pas de name:`).toBeTruthy()
    expect(nom, `${fichier} partage le nom du développement`).not.toBe(nomDuDev)
  })

  it.each(FICHIERS)('%s ne publie aucun port du développement', (fichier) => {
    // 3306 = base de dev, 3308 = sa base miroir. 3307 est pris par un autre projet de la machine.
    const portsDev = [...lire('docker-compose.dev.yml').matchAll(/'(\d+):\d+'/g)].map((m) =>
      Number(m[1])
    )
    const ports = [...lire(fichier).matchAll(/'(\d+):\d+'/g)].map((m) => Number(m[1]))
    const communs = ports.filter((p) => portsDev.includes(p))
    expect(communs, `${fichier} : ports partagés ${communs.join(', ')}`).toEqual([])
  })
})

describe('setup-db refuse une base qui n’est pas de test', () => {
  const setup = lire('test/setup-db.ts')

  it('🔬 porte la garde, et l’appelle AVANT toute connexion', () => {
    /*
     * La garde est appelée deux fois, et c'est voulu : dans le `beforeAll` pour que l'échec soit
     * franc et immédiat — avant qu'aucun test n'écrive —, et dans `cleanDatabase` au plus près de
     * la destruction, puisque rien n'empêche un futur appelant de la joindre autrement.
     */
    expect(setup).toContain('function exigerUneBaseDeTest')
    expect([...setup.matchAll(/exigerUneBaseDeTest\(\)/g)].length).toBeGreaterThanOrEqual(3)

    const positionGarde = setup.indexOf('exigerUneBaseDeTest()')
    const positionAttente = setup.indexOf('await waitForDatabase()')
    expect(positionGarde).toBeLessThan(positionAttente)
  })

  it('🔬 LÈVE au lieu d’avertir', () => {
    /*
     * ⚠️ Un avertissement laisserait la suite continuer, et le test suivant écrirait dans la base
     * de travail — c'est exactement ce que faisait le `catch` de `cleanDatabase`, qui transformait
     * déjà toute erreur de nettoyage en `console.warn`.
     */
    const corps = setup.slice(
      setup.indexOf('function exigerUneBaseDeTest'),
      setup.indexOf('function exigerUneBaseDeTest') + 600
    )
    expect(corps).toContain('throw new Error')
    expect(corps).not.toContain('console.warn')
  })

  it('ne vise plus la base de travail par défaut', () => {
    // L'ancien repli était `3308/convention_db` : le PORT de la base miroir du développement avec
    // le NOM de la base de travail. Aucune des deux valeurs ne désignait une base de test.
    const urls = urlsEnDur(setup)
    expect(urls.length, 'une URL de repli est attendue').toBeGreaterThan(0)
    expect(urls.every((u) => !u.includes('3308/convention_db'))).toBe(true)
    expect(urls.some((u) => u.includes('3310/convention_db_test'))).toBe(true)
  })

  it('le script de migration de test porte la même garde', () => {
    // `migrate-test.js` reprenait `DATABASE_URL` tel quel : lancé depuis l'hôte, il appliquait les
    // migrations à la base de DEV. Idempotent, donc invisible — mais c'est le même glissement.
    const migrate = lire('scripts/migrate-test.js')
    expect(migrate).toContain("includes('test')")
    expect(migrate).toContain('TEST_DATABASE_URL')
    expect(urlsEnDur(migrate).every((u) => !u.includes('3308/convention_db'))).toBe(true)
  })
})
