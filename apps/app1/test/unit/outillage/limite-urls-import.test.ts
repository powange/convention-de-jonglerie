import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Le plafond d'URL de l'import, verrouillé des DEUX côtés.
 *
 * ## ⚠️ POURQUOI CE TEST EXISTE
 *
 * `useUrlValidation.parseAndValidateUrls` **rejette le lot entier** au-delà de son `maxUrls`. Ce
 * n'est donc pas une troncature : envoyer six URL ne fait pas importer les cinq premières, il fait
 * échouer les six.
 *
 * L'écran de veille désactive son bouton « importer la sélection » au-delà du même nombre, qu'il
 * garde dans sa propre constante `MAX_URLS_IMPORT` — il ne peut pas lire le défaut d'un paramètre
 * de fonction. **Les deux valeurs doivent donc rester égales**, et rien dans le code ne les relie.
 *
 * Si elles divergeaient :
 * - plafond de l'écran **trop haut** → le bouton reste actif, l'opérateur part sur la page d'import
 *   et son lot entier est refusé là-bas, sans qu'il comprenne pourquoi ;
 * - plafond de l'écran **trop bas** → le bouton se désactive alors que l'import accepterait, et une
 *   partie du travail devient inatteignable.
 *
 * Aucun des deux ne lève d'erreur, aucun ne se voit à la relecture d'un seul fichier.
 */
const racine = resolve(__dirname, '../../..')

const lire = (chemin: string) => readFileSync(resolve(racine, chemin), 'utf-8')

describe('le plafond d’URL de l’import', () => {
  it('⚠️ est le MÊME dans l’écran de veille et dans la validation des URL', () => {
    const validation = lire('app/composables/useUrlValidation.ts')
    const ecran = lire('app/pages/admin/veille.vue')

    // Le défaut du paramètre, côté validation : `maxUrls: number = 5`
    const cotéValidation = validation.match(/maxUrls:\s*number\s*=\s*(\d+)/)
    // La constante, côté écran : `const MAX_URLS_IMPORT = 5`
    const cotéEcran = ecran.match(/const MAX_URLS_IMPORT\s*=\s*(\d+)/)

    /*
     * Ces deux assertions ne sont pas de la figuration : sans elles, un renommage ferait rendre
     * `null` aux deux expressions, et comparer `undefined` à `undefined` passerait au vert — le
     * test deviendrait creux exactement au moment où il devrait alerter.
     */
    expect(cotéValidation, 'le défaut `maxUrls` est introuvable dans useUrlValidation.ts').not.toBe(
      null
    )
    expect(cotéEcran, 'la constante `MAX_URLS_IMPORT` est introuvable dans veille.vue').not.toBe(
      null
    )

    expect(Number(cotéEcran![1])).toBe(Number(cotéValidation![1]))
  })

  it('⚠️ est le MÊME dans l’écran d’analyse et dans le serveur qui la refuse', () => {
    /*
     * Même piège que ci-dessus, sur l'autre écran qui alimente la même chaîne.
     * `/editions/[id]/gestion/ai-update` garde sa propre constante `MAX_URLS_ANALYSE` : il ne peut
     * pas lire le `.max()` d'un schéma zod côté serveur.
     *
     * Si elles divergeaient :
     * - écran **trop haut** → le bouton reste actif, l'organisateur attend l'analyse, et le serveur
     *   refuse la requête ENTIÈRE après coup, sans que rien n'ait prévenu ;
     * - écran **trop bas** → le bouton se désactive alors que le serveur accepterait, et des
     *   sources deviennent inutilisables.
     *
     * 📍 L'édition peut à elle seule fournir six liens (site, Facebook, Instagram, billetterie,
     * programme, JugglingEdge) avant la moindre source ajoutée : la limite est vite atteinte.
     */
    const ecran = lire('app/pages/editions/[id]/gestion/ai-update.vue')
    const serveurAgent = lire('server/api/admin/generate-import-json-agent.post.ts')
    const serveurFlux = lire('server/api/admin/generate-import-json-stream.get.ts')

    const cotéEcran = ecran.match(/const MAX_URLS_ANALYSE\s*=\s*(\d+)/)
    const cotéAgent = serveurAgent.match(
      /urls:\s*z\.array\(z\.string\(\)\.url\(\)\)\.min\(1\)\.max\((\d+)\)/
    )
    const cotéFlux = serveurFlux.match(/if \(urls\.length > (\d+)\)/)

    // Sans ces trois gardes, un renommage ferait rendre `null` partout, et comparer `undefined` à
    // `undefined` passerait au vert — le test deviendrait creux au moment d'alerter.
    expect(cotéEcran, '`MAX_URLS_ANALYSE` introuvable dans ai-update.vue').not.toBe(null)
    expect(cotéAgent, 'le `.max()` du schéma est introuvable côté agent').not.toBe(null)
    expect(cotéFlux, 'le contrôle de longueur est introuvable côté flux').not.toBe(null)

    expect(Number(cotéAgent![1])).toBe(Number(cotéEcran![1]))
    expect(Number(cotéFlux![1])).toBe(Number(cotéEcran![1]))
  })

  it('📍 l’écran passe les URL en paramètre RÉPÉTÉ, pas joint par un séparateur', () => {
    /*
     * `parseAndValidateUrls` découpe sur `\n` et sur rien d'autre. Un lien qui joindrait les URL
     * par une virgule produirait donc **une seule** URL invalide, et l'import refuserait le lot en
     * nommant une adresse que personne n'a saisie.
     *
     * Le lien doit passer un tableau — `query: { urls }` —, que la page d'import rejoint elle-même
     * par un retour à la ligne.
     */
    const ecran = lire('app/pages/admin/veille.vue')
    const page = lire('app/pages/admin/import-edition.vue')

    expect(ecran).toMatch(/query:\s*\{\s*urls\s*\}/)
    expect(ecran).not.toMatch(/urls\.join\(['"],['"]\)/)
    expect(page).toMatch(/urls\.join\('\\n'\)/)
  })
})
