import { readdirSync, readFileSync, type Dirent } from 'node:fs'
import { join, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

import { estUrlExterne, urlExterneNormalisee } from '../../../shared/utils/url-externe'

/**
 * Le lien externe, et ce que les deux moitiés en disent.
 *
 * La règle vivait en double : le réglage du bénévolat écartait les protocoles dangereux, les deux
 * points d'API d'appel à spectacles se contentaient d'un `z.string().url()` nu. Or `url()` ne juge
 * que la forme — mesuré ci-dessous, il accepte `javascript:`, `data:` et `file:`. Ce lien-là est
 * affiché aux candidats d'un appel à spectacles : c'est un lien qu'on leur propose de suivre.
 */

describe('ce qu’un lien externe doit être', () => {
  it('accepte les liens qu’on colle vraiment', () => {
    for (const bon of [
      'https://juggling.fr',
      'http://exemple.fr/appel?edition=2',
      'HTTPS://Exemple.FR',
      '  https://juggling.fr  ',
    ]) {
      expect(estUrlExterne(bon), bon).toBe(true)
    }
  })

  it('refuse ce qui n’est pas un lien', () => {
    for (const mauvais of ['juggling.fr', '', '   ', 'https://', 'trois mots']) {
      expect(estUrlExterne(mauvais), mauvais).toBe(false)
    }
  })

  it('refuse les protocoles qu’on ne propose pas de suivre', () => {
    // La raison d'être de ce module : `z.string().url()` les accepte tous les trois.
    for (const dangereux of [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd',
      'ftp://exemple.fr',
    ]) {
      expect(estUrlExterne(dangereux), dangereux).toBe(false)
    }
  })

  it('refuse au-delà de mille caractères', () => {
    expect(estUrlExterne('https://exemple.fr/' + 'a'.repeat(1000))).toBe(false)
  })

  it('rend le lien élagué, ou rien', () => {
    expect(urlExterneNormalisee('  https://juggling.fr  ')).toBe('https://juggling.fr')
    expect(urlExterneNormalisee('juggling.fr')).toBeNull()
  })
})

describe('aucun point d’API ne redéclare sa propre règle', () => {
  /*
   * Une garde de source, et non un appel au schéma.
   *
   * Les handlers importent des alias `#server` que le projet de tests unitaires ne résout pas : on
   * ne peut donc pas les charger ici pour les interroger. On lit leur source à la place, ce qui
   * couvre au passage TOUS les points d'API et pas seulement celui qu'on aurait pensé à importer.
   *
   * Ce que ce test empêche : qu'un `z.string().url()` ou `z.string().email()` nu réapparaisse.
   * Le premier accepte `javascript:`, `data:` et `file:` ; le second diverge de la règle partagée
   * sur cinq formes documentées dans `shared/utils/adresse-email.ts`.
   *
   * ⚠️ Le périmètre s'arrête aux points d'API d'une ÉDITION, celui de ce lot. Il en reste ailleurs,
   * au 24/09/2026 : dix fichiers avec un `url()` nu et dix avec un `email()` nu, dans
   * l'administration, l'authentification et le retour d'expérience. Durcir la règle d'e-mail sur
   * une route d'authentification peut refuser un compte existant dont l'adresse enregistrée est
   * biscornue — cela demande d'être mesuré sur les données réelles avant d'être fait, et non
   * glissé dans un lot qui parle d'autre chose.
   */
  // Depuis `apps/app1`, d'où vitest est lancé. `import.meta.url` n'est pas une URL `file:` une
  // fois le fichier transformé, et `fileURLToPath` y lève.
  const RACINES = [
    join(process.cwd(), 'server', 'api', 'editions'),
    join(process.cwd(), '..', '..', 'layers'),
  ]

  function fichiersApi(): string[] {
    const trouves: string[] = []
    const parcourir = (dossier: string) => {
      let entrees: Dirent[]
      try {
        entrees = readdirSync(dossier, { withFileTypes: true })
      } catch {
        return
      }
      for (const entree of entrees) {
        const chemin = join(dossier, entree.name)
        if (entree.isDirectory()) {
          if (entree.name === 'node_modules') continue
          parcourir(chemin)
        } else if (entree.name.endsWith('.ts') && chemin.includes(`${sep}editions${sep}`)) {
          trouves.push(chemin)
        }
      }
    }
    for (const racine of RACINES) parcourir(racine)
    return trouves
  }

  const sources = fichiersApi().map((chemin) => ({ chemin, texte: readFileSync(chemin, 'utf8') }))

  it('trouve bien les sources à inspecter', () => {
    // Sans cela, un chemin devenu faux rendrait les deux tests suivants vides et toujours verts.
    expect(sources.length).toBeGreaterThan(150)
  })

  it('aucun `z.string().url()` nu', () => {
    const fautifs = sources
      .filter(({ texte }) => /z\s*\.\s*string\(\)\s*\.\s*url\(/.test(texte))
      .map(({ chemin }) => chemin.split('/server/')[1] ?? chemin)
    expect(fautifs, 'utiliser schemaUrlExterne de shared/utils/url-externe').toEqual([])
  })

  it('aucun `z.string().email()` nu', () => {
    const fautifs = sources
      .filter(({ texte }) => /z\s*\.\s*string\(\)\s*\.\s*email\(/.test(texte))
      .map(({ chemin }) => chemin.split('/server/')[1] ?? chemin)
    expect(fautifs, 'utiliser schemaAdresseEmail de shared/utils/adresse-email').toEqual([])
  })
})
