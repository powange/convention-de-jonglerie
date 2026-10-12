import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Le téléchargement d'une sauvegarde ne passe plus par la mémoire — constat O2.
 *
 * ## Le défaut, et son asymétrie
 *
 * `readFile(backupPath)` chargeait le fichier **entier** dans un Buffer avant de le rendre. Or le
 * point d'API d'**envoi** voisin explique lui-même qu'« une archive complète pèse couramment
 * plusieurs centaines de Mo » — et c'est pour cela qu'il a été réécrit en flux. Le téléchargement,
 * son symétrique, ne l'avait pas été : deux administrateurs qui téléchargent en même temps
 * doublaient l'empreinte, et une archive de 500 Mo demandait 500 Mo de tas.
 *
 * C'est la même asymétrie que le constat O1 (la restauration en flux, la création en mémoire) :
 * dans les deux cas, une moitié du couple avait été traitée et l'autre oubliée.
 *
 * ## Le second point : l'en-tête reprenait le nom BRUT
 *
 * `Content-Disposition` recopiait `filename` tel qu'il arrivait, alors que `safeFilename`
 * — `path.basename` — existait déjà deux lignes plus haut pour construire le chemin. Un `"` ou un
 * saut de ligne dans le paramètre permettait d'y injecter ce qu'on voulait.
 *
 * ## ⚠️ Ce que `stat` rend, et qu'il ne faut pas perdre
 *
 * Le `Content-Length` : sans lui, le navigateur n'affiche **aucune progression** sur un
 * téléchargement de plusieurs centaines de mégaoctets — ce que le Buffer fournissait gratuitement.
 * Et il sert de contrôle d'existence, donc le 404 se déclenche toujours avant l'ouverture du flux.
 */
const SOURCE = join(import.meta.dirname, '../../../server/api/admin/backup/download.get.ts')

function code(): string {
  // Commentaires retirés : ce fichier cite `readFile` et `filename` pour expliquer l'ancien
  // défaut. Les compter en ferait des infractions — piège déjà payé plusieurs fois ici.
  return readFileSync(SOURCE, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
}

describe('téléchargement d’une sauvegarde', () => {
  it('⚠️ NE CHARGE PLUS L’ARCHIVE EN MÉMOIRE', () => {
    const src = code()
    expect(src).toContain('createReadStream(backupPath)')
    expect(src).toContain('sendStream(')
    expect(
      /readFile\(/.test(src),
      'le fichier repasse par `readFile`, qui charge tout en mémoire'
    ).toBe(false)
  })

  it('⚠️ ANNONCE TOUJOURS LA TAILLE — sans quoi le navigateur n’affiche aucune progression', () => {
    /*
     * Le témoin de ce qui serait PERDU par un passage au flux fait trop vite : le Buffer donnait
     * sa longueur gratuitement, un flux ne la donne pas. Sur une archive de plusieurs centaines
     * de mégaoctets, c'est la différence entre une barre de progression et une attente aveugle.
     */
    const src = code()
    expect(src).toContain('stat(backupPath)')
    expect(src).toMatch(/Content-Length['"],\s*infos\.size/)
  })

  it('⚠️ N’INJECTE PLUS LE NOM BRUT DANS L’EN-TÊTE', () => {
    const src = code()
    const entete = src.slice(src.indexOf('Content-Disposition'))
    expect(entete.slice(0, 120)).toContain('safeFilename')
    expect(
      /filename="\$\{filename\}"/.test(src),
      'le nom reçu est recopié brut dans Content-Disposition'
    ).toBe(false)
  })

  it('garde le 404 avant l’ouverture du flux', () => {
    // `stat` échoue en ENOENT, et le `catch` existant le traduit : un flux ouvert sur un fichier
    // absent rendrait une réponse 200 vide, ce qui est plus difficile à diagnostiquer qu'un 404.
    const src = code()
    expect(src).toContain("fileError.code === 'ENOENT'")
    /*
     * 📍 On compare à l'APPEL `createReadStream(backupPath)` et non au nom seul : celui-ci
     * apparaît d'abord dans l'`import` en tête de fichier, si bien que la comparaison portait sur
     * la ligne 1 et échouait sur un code pourtant juste (« expected 725 to be less than 9 »).
     */
    expect(src.indexOf('stat(backupPath)')).toBeLessThan(
      src.indexOf('createReadStream(backupPath)')
    )
  })

  it('le balayage lit bien le fichier — il ne conclut pas sur le vide', () => {
    expect(code().length, 'source vide ou introuvable').toBeGreaterThan(800)
  })
})
