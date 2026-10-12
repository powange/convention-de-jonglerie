import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Fermer l'onglet arrête vraiment la génération — constat O1 de l'import IA.
 *
 * ## Le défaut
 *
 * Le flux SSE détectait la déconnexion du client, posait `isCancelled` et fermait le tuyau — mais
 * **aucun signal n'atteignait** `generateImportJson` ni `runAgentExploration`. Leur seul effet
 * était de ne pas **envoyer** le résultat : la génération continuait jusqu'au bout, appels au
 * modèle et téléchargements compris.
 *
 * Une passe programme sur neuf journées est mesurée à **24 min 30 s**. Un rechargement de page la
 * laissait tourner en entier — occupant le modèle local, ou facturant Anthropic, pour un résultat
 * jeté. Et l'écran n'offrait **aucun** bouton d'annulation : la seule façon d'arrêter était de
 * quitter la page, ce qui n'arrêtait rien.
 *
 * ## ⚠️ LE DÉFAUT QUI REND CE GENRE DE CÂBLAGE TRAÎTRE
 *
 * `fetchWithTimeout` **écrasait silencieusement** le `signal` de l'appelant (`signal:
 * controller.signal` remplaçait celui d'`options`). Passer un `AbortSignal` n'avait donc aucun
 * effet, sans le moindre avertissement — on aurait pu croire l'annulation branchée alors qu'elle
 * ne l'était pas. Il combine désormais les deux par `AbortSignal.any`.
 *
 * Et deux fonctions du module — `callAgentLLM`, `fetchAndExtractContent` — sont **hors de la
 * portée** du signal de `runAgentExploration` : il leur est passé en paramètre. Un signal
 * s'arrête à la première fonction qui ne le reçoit pas, et rien ne le signale.
 *
 * ## Pourquoi une garde de source
 *
 * Éprouver l'annulation pour de vrai demanderait de doubler le SDK Anthropic, LM Studio, le
 * navigateur sans interface et le temps. Ce qui compte ici est que le signal **soit transmis** à
 * chaque frontière — et cela se lit. Ce qu'on garde, c'est la chaîne.
 */
const RACINE = join(import.meta.dirname, '../../../..')

const lire = (relatif: string) =>
  readFileSync(join(RACINE, relatif), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')

const FLUX = 'app1/server/api/admin/generate-import-json-stream.get.ts'
const DIRECT = 'app1/server/api/admin/generate-import-json.post.ts'
const AGENT = 'app1/server/api/admin/generate-import-json-agent.post.ts'
const FETCH = 'app1/server/utils/fetch-helpers.ts'

describe('import IA — l’annulation traverse toute la chaîne', () => {
  it('⚠️ LE FLUX SSE ABANDONNE À LA DÉCONNEXION', () => {
    const src = lire(FLUX)
    expect(src).toContain('new AbortController()')
    // `abort()` DANS le nettoyage : ailleurs, il ne se déclencherait pas au départ du client.
    const nettoyage = src.slice(src.indexOf('const cleanup ='), src.indexOf('event.node.req.on'))
    expect(nettoyage).toContain('arret.abort()')
  })

  it('⚠️ LE SIGNAL EST TRANSMIS AUX DEUX CHEMINS DE GÉNÉRATION', () => {
    // Le témoin de ce que le constat dénonçait : un abandon qui ne descend pas ne sert à rien.
    const src = lire(FLUX)
    expect((src.match(/signal: arret\.signal/g) ?? []).length).toBe(2)
  })

  it('⚠️ `fetchWithTimeout` NE L’ÉCRASE PLUS', () => {
    const src = lire(FETCH)
    expect(src).toContain('AbortSignal.any([controller.signal, options.signal])')
  })

  it('les deux chemins s’arrêtent entre les étapes', () => {
    /*
     * Les frontières d'étape sont ce qui borne la dépense : au pire on paie une étape — une
     * journée de programme, un tour d'agent — après le départ du client.
     */
    /*
     * 📍 LES NOMBRES SONT EXACTS, et non des seuils : un seuil « plus de 3 » ne dit pas combien de
     * frontières existent, et il laisse passer la disparition de l'une d'elles tant que le compte
     * reste au-dessus. Mon premier essai l'a d'ailleurs écrit « > 3 » pour un fichier qui en a
     * exactement 3 — le test échouait sur un code juste.
     *
     * Chemin direct : 7 vérifications (six frontières d'étape + une par page téléchargée), plus
     * la définition de la fonction, que le motif attrape aussi.
     * Agent : 3 vérifications (pages de départ, liens externes, chaque tour) ; sa fonction est une
     * constante fléchée, donc non comptée.
     */
    expect((lire(DIRECT).match(/exigerQueLArretNAitPasEteDemande\(/g) ?? []).length).toBe(8)
    expect((lire(AGENT).match(/exigerQueLArretNAitPasEteDemande\(/g) ?? []).length).toBe(3)
  })

  it('⚠️ LES FONCTIONS DE MODULE REÇOIVENT LE SIGNAL, faute de pouvoir le lire', () => {
    const src = lire(AGENT)
    // La signature, puis l'appel au modèle qui s'en sert.
    expect(src).toMatch(/async function callAgentLLM\([\s\S]{0,400}signal\?: AbortSignal/)
    expect(src).toMatch(/async function fetchAndExtractContent\([\s\S]{0,600}signal\?: AbortSignal/)
    expect(src).toContain('{ signal }')
  })

  it('⚠️ L’ÉCRAN OFFRE UN BOUTON D’ANNULATION', () => {
    // Il n'en existait aucun. Fermer le flux est ce qui arrête le travail côté serveur.
    const composable = lire('app1/app/composables/useImportGeneration.ts')
    expect(composable).toContain('const annuler =')
    expect(composable).toContain('fluxCourant.value?.close()')
    expect(lire('app1/app/pages/editions/[id]/gestion/ai-update.vue')).toContain('@click="annuler"')
  })

  it('le balayage lit bien les fichiers — il ne conclut pas sur le vide', () => {
    for (const f of [FLUX, DIRECT, AGENT, FETCH]) {
      expect(lire(f).length, `${f} est vide ou introuvable`).toBeGreaterThan(2000)
    }
  })
})
