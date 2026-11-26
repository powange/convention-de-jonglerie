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
})
