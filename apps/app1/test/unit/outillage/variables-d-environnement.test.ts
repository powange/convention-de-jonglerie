import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, it, expect } from 'vitest'

const RACINE = process.cwd()
const MODELE = join(RACINE, '.env.portainer.example')

/**
 * Le modèle d'environnement dit-il la vérité ? — constat F1.
 *
 * ## ⚠️ LE DÉFAUT
 *
 * `.env.portainer.example` est le **seul** modèle livré (il n'existe pas de `.env.example`). Il
 * omettait `NUXT_SESSION_PASSWORD`, que `server/plugins/validate-config.ts` exige sous peine
 * d'arrêt immédiat : quelqu'un qui montait une pile depuis ce modèle obtenait un conteneur qui
 * **redémarre en boucle**, avec un message qu'il ne pouvait lire qu'en allant chercher les
 * journaux. Il omettait aussi les réglages SMTP, l'adresse publique, les niveaux de journal et les
 * délais d'IA.
 *
 * Et il documentait **quatre variables que rien ne lit** : `JWT_SECRET`, `APP_URL`, `APP_PORT`,
 * `DB_PORT`. C'est le symétrique, et c'est pire que l'omission : une variable documentée qu'on
 * renseigne et qui ne fait rien envoie chercher la cause partout sauf au bon endroit. `APP_PORT`
 * annonçait même « optionnel si vous voulez changer les ports par défaut », alors qu'aucun compose
 * ne l'interpole.
 *
 * ## ⚠️⚠️ POURQUOI UN TEST ET NON UNE SIMPLE MISE À JOUR
 *
 * Ce fichier s'était désynchronisé **tout seul**, par accumulation : chaque nouvelle variable lue
 * dans le code sans être ajoutée ici. Une mise à jour ponctuelle serait périmée au prochain lot.
 * Le test compare **dans les deux sens** : ce que le code lit doit être documenté, et ce qui est
 * documenté doit être lu.
 *
 * ⚠️ IL LIT LE CODE, PAS UNE LISTE. La liste des variables se tire des sources
 * (`process.env.XXX`), donc elle ne peut pas se périmer ; seule la liste des **exceptions**
 * ci-dessous est à tenir, et chacune porte sa raison.
 *
 * ⚠️ IL VIT DANS LE PROJET `unit`, ET NON `nuxt`, parce que celui-ci tourne DANS LE CONTENEUR, où
 * `.env.portainer.example` n'est pas monté : les trois cas y échouaient sur un `ENOENT` qui
 * n'apprenait rien. Le projet `unit` tourne sur l'hôte, à la racine du dépôt — là où le fichier
 * qu'on vérifie existe réellement.
 */

/**
 * Les variables que le code lit et qu'on ne documente PAS, chacune avec sa raison.
 *
 * ⚠️ Une liste d'exceptions est le point faible de ce genre de garde : elle peut finir par exempter
 * un vrai cas. D'où la raison écrite à côté de chacune — relire la liste, c'est relire les raisons.
 */
const NON_DOCUMENTEES_A_DESSEIN: Record<string, string> = {
  NODE_ENV: 'posée par Node et par le Dockerfile, jamais par l’exploitant',
  DATABASE_URL:
    'construite par `docker/entrypoint.sh` ; le modèle dit explicitement de NE PAS la poser',
  NUXT_BUILD_SHA: 'posée par le Dockerfile au moment de la construction de l’image',
  E2E_TEST: 'posée par la suite de bout en bout, jamais en production',
  VERCEL_ENV: 'détection de plateforme, pour un hébergeur que ce projet n’utilise pas',
  NUXT_BROWSERLESS_URL: 'second nom de BROWSERLESS_URL, documenté sous ce nom-là',
}

/** Les variables documentées qui ne sont pas lues par le code TypeScript, et pourquoi c'est juste. */
const DOCUMENTEES_HORS_DU_CODE: Record<string, string> = {
  MYSQL_ROOT_PASSWORD: 'lue par le compose (image mysql)',
  MYSQL_DATABASE: 'lue par le compose et par `docker/entrypoint.sh`',
  MYSQL_USER: 'lue par le compose et par `docker/entrypoint.sh`',
  MYSQL_PASSWORD: 'lue par le compose et par `docker/entrypoint.sh`',
  NUXT_SITE_ENV: 'lue à l’exécution par @nuxtjs/seo, pas par notre code',
}

/** Toutes les variables lues par le code du serveur et la configuration Nuxt. */
async function variablesLuesParLeCode(): Promise<Set<string>> {
  const racines = [
    join(RACINE, 'server'),
    join(RACINE, '..', '..', 'layers'),
    join(RACINE, 'nuxt.config.ts'),
  ]
  const trouvees = new Set<string>()

  const parcourir = async (chemin: string) => {
    /*
     * ⚠️ `generated` EST EXCLU, et l'oublier m'a donné une première mesure fausse : le client
     * Prisma généré vit sous `server/generated/` et lit ses propres variables — `COMPUTERNAME`,
     * `_CLUSTER_NETWORK_NAME_`, `NO_COLOR`… Sept entrées de bruit dans une liste de soixante-huit,
     * qu'on aurait documentées pour rien.
     */
    if (/\/(node_modules|generated|\.nuxt|dist)(\/|$)/.test(chemin)) return

    let entrees
    try {
      entrees = await readdir(chemin, { withFileTypes: true })
    } catch {
      // Un fichier et non un dossier : on le lit.
      if (/\.(ts|js|mjs)$/.test(chemin)) {
        const source = await readFile(chemin, 'utf8')
        for (const trouve of source.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
          trouvees.add(trouve[1]!)
        }
      }
      return
    }

    for (const entree of entrees) {
      await parcourir(join(chemin, entree.name))
    }
  }

  for (const racine of racines) await parcourir(racine)
  return trouvees
}

/** Les variables que le modèle documente, actives ou commentées en exemple. */
async function variablesDuModele(): Promise<Set<string>> {
  const contenu = await readFile(MODELE, 'utf8')
  const trouvees = new Set<string>()
  for (const ligne of contenu.split('\n')) {
    // `NOM=` en début de ligne, ou `#   NOM=` pour un exemple commenté.
    const trouve = ligne.match(/^#?\s*([A-Z][A-Z0-9_]+)=/)
    if (trouve) trouvees.add(trouve[1]!)
  }
  return trouvees
}

describe('le modèle d’environnement', () => {
  it('⚠️ DOCUMENTE TOUT CE QUE LE CODE LIT', async () => {
    const lues = await variablesLuesParLeCode()
    const documentees = await variablesDuModele()

    // Sentinelle : une mesure qui ne lirait rien passerait sans bruit.
    expect(lues.size).toBeGreaterThan(40)

    const manquantes = [...lues]
      .filter((v) => !documentees.has(v) && !(v in NON_DOCUMENTEES_A_DESSEIN))
      .sort()

    expect(manquantes).toEqual([])
  })

  it('⚠️ NE DOCUMENTE RIEN QUE LE CODE NE LISE', async () => {
    /*
     * LE SENS QU'ON OUBLIE, et celui qui avait pourri : quatre variables ne vivaient plus que dans
     * ce fichier. `JWT_SECRET` promettait une authentification par jeton qui n'existe pas, et
     * `APP_PORT` promettait un réglage sans effet.
     */
    const lues = await variablesLuesParLeCode()
    const documentees = await variablesDuModele()

    const orphelines = [...documentees]
      .filter((v) => !lues.has(v) && !(v in DOCUMENTEES_HORS_DU_CODE))
      .sort()

    expect(orphelines).toEqual([])
  })

  it('⚠️ DOCUMENTE LA VARIABLE SANS LAQUELLE LE CONTENEUR S’ARRÊTE', async () => {
    /*
     * Le cas qui justifie à lui seul ce lot. `validate-config.ts` lève si `NUXT_SESSION_PASSWORD`
     * est absente ou fait moins de 32 caractères : la pile redémarre en boucle, et le modèle n'en
     * parlait pas. Le test exige aussi que la commande de génération soit là — sans elle, on sait
     * qu'il faut une valeur, pas comment l'obtenir.
     */
    const contenu = await readFile(MODELE, 'utf8')

    expect(contenu).toContain('NUXT_SESSION_PASSWORD=')
    expect(contenu).toContain('openssl rand -base64 32')
    expect(contenu).toContain('32 caractères')
  })

  it('les exceptions portent toutes une raison', () => {
    /*
     * ⚠️ LE GARDE-FOU DU GARDE-FOU. Une liste d'exceptions sans justification devient le trou par
     * lequel la règle se vide : il suffit d'y ajouter un nom pour faire taire le test. Exiger une
     * raison non vide ne force pas une bonne raison, mais force à en écrire une — et une raison
     * écrite se relit.
     */
    for (const [nom, raison] of Object.entries({
      ...NON_DOCUMENTEES_A_DESSEIN,
      ...DOCUMENTEES_HORS_DU_CODE,
    })) {
      expect(raison.length, nom).toBeGreaterThan(20)
    }
  })
})
