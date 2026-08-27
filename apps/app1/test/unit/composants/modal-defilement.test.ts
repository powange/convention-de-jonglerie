import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Garde-fou : une UModal qui remplace sa structure interne doit gérer son débordement.
 *
 * La boîte d'une UModal porte `max-h-[calc(100dvh-2rem)]` **et** `overflow-hidden` : elle borne
 * sa hauteur, puis coupe ce qui dépasse. Ce sont les slots natifs qui rattrapent cela, le corps
 * étant rendu avec `flex-1 overflow-y-auto`. Le slot `#content`, lui, remplace toute cette
 * structure — en-tête, corps et pied — et donc ce conteneur de défilement.
 *
 * Résultat, sur un écran court : le contenu est tronqué sans barre de défilement et les boutons
 * du bas deviennent inatteignables. Un utilisateur l'a signalé sur la modal de traitement d'un
 * retour, où le bouton « Enregistrer » sortait de l'écran. Le défaut dormait aussi dans la
 * création d'un appel à spectacles, et avait déjà été rattrapé à la main ailleurs — trois fois
 * la même erreur, d'où ce test plutôt qu'une correction ponctuelle.
 *
 * Un `#content` reste permis s'il borne lui-même son débordement.
 */

const RACINES = [
  path.resolve(__dirname, '../../../app'),
  path.resolve(__dirname, '../../../../../layers'),
]

function fichiersVue(dossier: string, trouves: string[] = []): string[] {
  if (!fs.existsSync(dossier)) return trouves
  for (const entree of fs.readdirSync(dossier, { withFileTypes: true })) {
    if (entree.name === 'node_modules' || entree.name.startsWith('.')) continue
    const complet = path.join(dossier, entree.name)
    if (entree.isDirectory()) fichiersVue(complet, trouves)
    else if (entree.name.endsWith('.vue')) trouves.push(complet)
  }
  return trouves
}

const indentation = (ligne: string) => ligne.length - ligne.trimStart().length

/**
 * Slots `#content` appartenant directement à une UModal — `#content` existe aussi sur
 * UPopover, UTooltip ou UDropdownMenu, où l'absence de défilement n'a rien de fautif.
 * Un enfant direct est indenté d'exactement un niveau de plus que la balise qui l'ouvre.
 */
function contentsDeModal(source: string): { ligne: number; corps: string }[] {
  const lignes = source.split('\n')
  const trouves: { ligne: number; corps: string }[] = []

  lignes.forEach((ligne, i) => {
    if (!ligne.includes('<UModal')) return
    const indentModal = indentation(ligne)

    for (let j = i + 1; j < lignes.length; j++) {
      const courante = lignes[j]!
      const indent = indentation(courante)
      if (courante.includes('</UModal>') && indent === indentModal) break
      if (!courante.includes('<template #content') || indent !== indentModal + 2) continue

      const corps: string[] = []
      for (let k = j + 1; k < lignes.length; k++) {
        const l = lignes[k]!
        if (l.trim() === '</template>' && indentation(l) === indent) break
        corps.push(l)
      }
      trouves.push({ ligne: i + 1, corps: corps.join('\n') })
      break
    }
  })

  return trouves
}

describe('défilement des UModal', () => {
  const fichiers = RACINES.flatMap((racine) => fichiersVue(racine))

  it('trouve bien des fichiers à analyser', () => {
    expect(fichiers.length).toBeGreaterThan(100)
  })

  it('aucune UModal ne remplace sa structure sans gérer son débordement', () => {
    const fautives: string[] = []

    for (const fichier of fichiers) {
      const source = fs.readFileSync(fichier, 'utf8')
      if (!source.includes('<UModal')) continue

      for (const { ligne, corps } of contentsDeModal(source)) {
        if (!/overflow-y-auto|overflow-auto/.test(corps)) {
          fautives.push(`${path.relative(RACINES[0]!, fichier)}:${ligne}`)
        }
      }
    }

    expect(
      fautives,
      'Ces UModal utilisent #content sans borner leur débordement : leur contenu sera coupé ' +
        'sans défilement sur un écran court. Préférer les slots natifs #header / #body / #footer, ' +
        'qui donnent un corps défilant et un pied épinglé.'
    ).toEqual([])
  })
})
