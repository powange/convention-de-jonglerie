import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Les pages et composants des layers d'événement (bénévoles, carte…) lisent l'id de l'événement par `useEditionId()` /
 * `useEditionIdRef()`, jamais dans l'adresse.
 *
 * App1 met le numéro dans ses adresses (`/editions/12/…`), mais Flowvent y met un identifiant
 * public aléatoire (`/events/58e143cb3f/…`) : `Number(route.params.id)` y rend `NaN`, et la page
 * appelle ses API avec `NaN` — sans erreur visible, sans test rouge, juste une page vide ou un 404.
 */
const DEPOT = resolve(process.cwd(), '..', '..')
// Chaque layer d'événement monté dans Flowvent : bénévoles, puis chaque module porté.
const RACINES = [
  'layers/volunteers/app',
  'layers/map/app',
  'layers/stock/app',
  'layers/artists/app',
  'layers/ticketing/app',
  'layers/meals/app',
  'layers/treasury/app',
].map((r) => join(DEPOT, r))
const LECTURE_DIRECTE = /\b(?:route|useRoute\(\))\.params\.id\b/

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom)
    if (statSync(chemin).isDirectory()) return fichiers(chemin)
    return /\.(vue|ts)$/.test(nom) ? [chemin] : []
  })
}

describe('layers d’événement — id de l’événement', () => {
  it('aucune page ni composant ne lit route.params.id (hors useEditionId lui-même)', () => {
    const tous = RACINES.flatMap(fichiers)
    expect(tous.length).toBeGreaterThan(50)
    const fautifs = tous
      .filter((f) => !f.endsWith('useEditionId.ts'))
      .filter((f) => {
        const sansCommentaires = readFileSync(f, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/[^\n]*/g, '')
          .replace(/<!--[\s\S]*?-->/g, '')
        return LECTURE_DIRECTE.test(sansCommentaires)
      })
      .map((f) => f.slice(DEPOT.length + 1))
    expect(fautifs).toEqual([])
  })

  /*
   * L'ÉDITION se charge par le store (`editionStore.fetchEditionById`), que chaque app fournit —
   * jamais par `/api/editions/:id`, qui n'existe que dans app1 : dans Flowvent, la page sortait
   * vide (espace artiste, pages des appels à spectacles).
   */
  it('aucune page ni composant ne charge l’édition par /api/editions/:id', () => {
    const appelDirect = /\/api\/editions\/\$\{[^}]+\}[`'"]/
    const fautifs = RACINES.flatMap(fichiers)
      .filter((f) => appelDirect.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(DEPOT.length + 1))
    expect(fautifs).toEqual([])
  })

  /*
   * Un layer ne vise JAMAIS une app par un chemin relatif (`../../apps/app1/…`) : il passe par
   * `#server/…`, `~/…` ou un alias de layer. Le script de réécriture des imports en a produit trois
   * fois au fil du portage ; dans Flowvent, ces fichiers n'existent pas — page en erreur au build.
   */
  it('aucun layer n’importe une app par un chemin relatif', () => {
    const versUneApp = /(?:from|import\()\s*'(?:\.\.\/)+apps\/app\d/
    const racinesLayers = readdirSync(join(DEPOT, 'layers'))
      .filter((l) => l !== 'node_modules' && statSync(join(DEPOT, 'layers', l)).isDirectory())
      .map((l) => join(DEPOT, 'layers', l))
    const fautifs = racinesLayers
      .flatMap(fichiers)
      .filter((f) => !f.includes('/node_modules/'))
      .filter((f) => versUneApp.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(DEPOT.length + 1))
    expect(fautifs).toEqual([])
  })
})
