import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { MODULES_DE_GESTION } from '../../../app/utils/modules-de-gestion'

/**
 * Trois surfaces mènent aux mêmes modules de gestion, et aucune ne doit en oublier.
 *
 * ⚠️ POURQUOI CE TEST EXISTE. La barre latérale offrait trois pages que l'accueil ne proposait
 * pas — « Doublons de repas », « Emprunts » et « Ce qui manque » —, et personne ne pouvait le
 * voir : les deux listes sont écrites à la main, à deux endroits, dans deux syntaxes
 * différentes. C'est un utilisateur qui l'a signalé.
 *
 * 📍 L'oubli était MASQUÉ une seconde fois par le registre : `moduleDeGestion` retombe sur le
 * module parent, si bien que `stock/loans` empruntait l'icône et la couleur du stock et que
 * l'en-tête de sa page paraissait juste. Un oubli qui s'affiche correctement ne se corrige
 * jamais.
 *
 * Ce test ne vérifie pas que les liens « marchent » — il vérifie que les trois listes disent la
 * même chose. Le jour où l'une s'enrichit seule, il nomme l'écart.
 */

const racine = path.resolve(__dirname, '../../..')
const barre = fs.readFileSync(path.join(racine, 'app/layouts/edition-dashboard.vue'), 'utf8')
const accueil = fs.readFileSync(
  path.join(racine, 'app/pages/editions/[id]/gestion/index.vue'),
  'utf8'
)

/**
 * Les destinations de la barre latérale : `to: \`/editions/${editionId.value}/gestion/…\``.
 *
 * Volontairement ancré sur la forme exacte employée dans le fichier. Si quelqu'un change cette
 * forme, l'extraction rend une liste vide — et le garde-fou `PLANCHER` ci-dessous le signale, au
 * lieu de laisser le test passer sur deux ensembles vides.
 */
function destinationsDeLaBarre(): string[] {
  const trouvees = [
    ...barre.matchAll(/to:\s*`\/editions\/\$\{editionId\.value\}\/gestion\/([a-z0-9/_-]*)`/g),
  ]
  return [...new Set(trouvees.map((m) => m[1]!).filter(Boolean))].sort()
}

/** Les destinations des cartes de l'accueil : `:to="\`/editions/${edition.id}/gestion/…\`"`. */
function destinationsDeLAccueil(): string[] {
  const trouvees = [
    ...accueil.matchAll(/to="`\/editions\/\$\{edition\.id\}\/gestion\/([a-z0-9/_-]*)`"/g),
  ]
  return [...new Set(trouvees.map((m) => m[1]!).filter(Boolean))].sort()
}

/*
 * Un test qui compare deux listes vides est vert et ne prouve rien. Ce plancher — nettement sous
 * le compte réel, 45 de part et d'autre au 05/10/2026 — fait échouer bruyamment une extraction
 * devenue aveugle, plutôt que de la laisser conclure à la parité.
 */
const PLANCHER = 35

/**
 * Ce que la barre latérale offre et que l'accueil n'a PAS à offrir.
 *
 * Une seule entrée, et il faut une raison écrite pour en ajouter une : « Vue d'ensemble » renvoie
 * à l'accueil lui-même, qui n'a pas à proposer une carte vers soi.
 */
const ABSENCES_ADMISES_SUR_L_ACCUEIL = new Set<string>([])

describe('les liens de gestion disent la même chose partout', () => {
  const barreListe = destinationsDeLaBarre()
  const accueilListe = destinationsDeLAccueil()

  it('extrait bien les deux listes', () => {
    expect(barreListe.length, 'destinations de la barre latérale').toBeGreaterThanOrEqual(PLANCHER)
    expect(accueilListe.length, 'destinations des cartes de l’accueil').toBeGreaterThanOrEqual(
      PLANCHER
    )
  })

  it('l’accueil propose tout ce que la barre latérale offre', () => {
    const absents = barreListe.filter(
      (d) => !accueilListe.includes(d) && !ABSENCES_ADMISES_SUR_L_ACCUEIL.has(d)
    )
    expect(absents, 'à ajouter en carte sur l’accueil de gestion').toEqual([])
  })

  it('la barre latérale offre tout ce que l’accueil propose', () => {
    const absents = accueilListe.filter((d) => !barreListe.includes(d))
    expect(absents, 'à ajouter dans la barre latérale').toEqual([])
  })

  it('chaque destination a son ENTRÉE PROPRE au registre', () => {
    /*
     * `moduleDeGestion` ne suffit pas ici : il retomberait sur le parent et rendrait ce test
     * vacuement vert, ce qui est précisément le défaut qu'il doit attraper. On interroge donc la
     * table directement.
     */
    const sansEntree = barreListe.filter((d) => !MODULES_DE_GESTION[d])
    expect(sansEntree, 'à déclarer dans MODULES_DE_GESTION (icône + couleur)').toEqual([])
  })

  it('le registre ne garde pas de module que plus personne n’atteint', () => {
    const orphelins = Object.keys(MODULES_DE_GESTION).filter((cle) => !barreListe.includes(cle))
    expect(orphelins, 'module au registre sans aucun lien vers lui').toEqual([])
  })
})
