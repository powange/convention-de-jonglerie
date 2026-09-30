import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../../../server/handlers/assetlinks'
import { global } from '../globales-nitro'

/**
 * Le câblage entre la variable d'environnement et le fichier Digital Asset Links.
 *
 * ⚠️ POURQUOI CE TEST EXISTE EN PLUS DES TESTS UNITAIRES de `liens-application-android`. Ceux-là
 * éprouvent la COMPOSITION du fichier ; celui-ci éprouve qu'elle est bien alimentée par
 * `ANDROID_SIGNING_FINGERPRINTS`. C'est exactement le maillon qui a lâché en septembre 2026 sur
 * `DATABASE_URL` : la valeur était correcte, le code qui la lisait était correct, et elle
 * n'arrivait simplement jamais jusqu'au processus. Release a refusé de démarrer.
 *
 * Ici, l'équivalent ne ferait même pas de bruit : le fichier rendrait `[]`, le serveur répondrait
 * 200, et le seul symptôme serait la barre d'adresse de Chrome au-dessus de l'application Android.
 */

const EMPREINTE =
  '14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42:E6:1D:BE:A8:8A:04:96:B2:3F:CF:44:E5'

const evenement = {} as any

describe('GET /.well-known/assetlinks.json', () => {
  const valeurInitiale = process.env.ANDROID_SIGNING_FINGERPRINTS

  beforeEach(() => {
    vi.clearAllMocks()
    global.setHeader = vi.fn() as any
  })

  afterEach(() => {
    if (valeurInitiale === undefined) delete process.env.ANDROID_SIGNING_FINGERPRINTS
    else process.env.ANDROID_SIGNING_FINGERPRINTS = valeurInitiale
  })

  it('rend un tableau VIDE quand la variable n’est pas posée', () => {
    /*
     * L'état du jour, et il doit rester lisible : l'empreinte n'est connue qu'après le premier
     * envoi sur le Play Store. Un tableau vide dit « aucune application associée ». Une entrée
     * d'exemple dirait « celle-ci est associée », et la vraie se verrait refuser.
     */
    delete process.env.ANDROID_SIGNING_FINGERPRINTS

    expect(handler(evenement)).toEqual([])
  })

  it('reprend l’empreinte de la variable d’environnement', () => {
    // 🔬 L'assertion qui porte ce test : la variable est bien LUE. Le reste est éprouvé à part.
    process.env.ANDROID_SIGNING_FINGERPRINTS = EMPREINTE

    const reponse = handler(evenement) as any[]

    expect(reponse).toHaveLength(1)
    expect(reponse[0].target.sha256_cert_fingerprints).toEqual([EMPREINTE])
    expect(reponse[0].target.package_name).toBe('com.jugglingconvention.app')
  })

  it('annonce du JSON', () => {
    /*
     * Android refuse un `assetlinks.json` qui n'est pas servi en `application/json` — et il le
     * refuse sans rien dire, comme le reste. L'en-tête est posé explicitement parce que cette
     * route ne finit pas par `.json` du point de vue de Nitro : elle est déclarée à la main.
     */
    handler(evenement)

    expect(global.setHeader).toHaveBeenCalledWith(
      evenement,
      'Content-Type',
      expect.stringContaining('application/json')
    )
  })

  it('n’émet RIEN pour une empreinte au mauvais format', () => {
    /*
     * Une SHA-1 recopiée à la place d'une SHA-256 — les deux sont affichées côte à côte dans la
     * console Play. Mieux vaut un tableau vide, qui se diagnostique, qu'une association vers une
     * clé qui n'existe pas.
     */
    process.env.ANDROID_SIGNING_FINGERPRINTS = '14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64'

    expect(handler(evenement)).toEqual([])
  })
})
