import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Supprimer une sauvegarde : la confirmation dit QUOI va disparaître — constat F1 de
 * l'administration.
 *
 * ## ⚠️ LA MOITIÉ DU CONSTAT ÉTAIT DÉJÀ LIVRÉE
 *
 * La fiche décrivait un `confirm()` natif, « non stylé, non traduit par le thème, absent sur
 * certains navigateurs mobiles en mode bloquer les dialogues ». Il a été remplacé par
 * `useConfirmation()` et `<UiConfirmationDemandee>` dans un lot antérieur — commentaire
 * d'explication compris. Vérifié avant d'y toucher plutôt que corrigé deux fois.
 *
 * ## Ce qui restait
 *
 * La modale ne nommait que le FICHIER. Or une liste de sauvegardes contient plusieurs archives
 * dont les noms ne diffèrent que par leur horodatage : c'est la date et la taille qui permettent
 * de reconnaître celle qu'on veut vraiment perdre. Les deux sont affichées dans la ligne, juste à
 * côté du bouton — ne pas les reprendre obligeait à mémoriser la ligne avant de cliquer. Et le
 * bouton de confirmation était resté à la couleur par défaut, là où la restauration voisine —
 * tout aussi définitive — a son bouton rouge.
 *
 * ## ⚠️⚠️ CE QUE CETTE GARDE N'EST PAS
 *
 * Une garde de **source**. Monter cette page demanderait le middleware super-admin, la liste des
 * sauvegardes, l'état de restauration et six points d'API ; ce qui est en cause ici tient dans
 * l'appel à `demanderConfirmation`, et le composant qui l'affiche est éprouvé ailleurs. Elle ne
 * prouve donc pas ce qui s'affiche — elle prouve que les trois faits sont passés à la modale, et
 * que le `confirm()` natif n'est pas revenu.
 */
const RACINE = path.resolve(__dirname, '../../../../..')
const PAGE = 'apps/app1/app/pages/admin/backup.vue'

/** Le code de la page, commentaires retirés — ceux de HTML compris. */
function sansCommentaires(): string {
  return fs
    .readFileSync(path.resolve(RACINE, PAGE), 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

describe('administration — supprimer une sauvegarde', () => {
  it('ne passe plus par la boîte native du navigateur', () => {
    // ⚠️ Le retrait des commentaires n'est pas décoratif : la page EXPLIQUE, en citant
    // `confirm()`, pourquoi elle ne l'emploie plus. Les compter accuserait le fichier qui a fait
    // le travail — motif payé six fois dans ce dépôt.
    const code = sansCommentaires()
    expect(code).not.toMatch(/\bconfirm\(/)
    expect(code).not.toContain('window.confirm')
  })

  it('passe par la confirmation du projet', () => {
    const code = sansCommentaires()
    expect(code).toContain('const confirmation = useConfirmation()')
    expect(code).toContain('<UiConfirmationDemandee :confirmation="confirmation" />')
  })

  it('reçoit la sauvegarde entière, et non son seul nom', () => {
    // 📍 C'est ce qui rend la date et la taille atteignables : avec le seul nom de fichier, elles
    // ne l'étaient pas.
    const code = sansCommentaires()
    expect(code).toContain('@click="deleteBackup(backup)"')
    expect(code).toContain('const deleteBackup = (backup: Backup) => {')
  })

  it('annonce le nom, la date ET la taille', () => {
    // Les trois, et pas « au moins un » : un compte partiel laisserait retomber la date ou la
    // taille sans rien signaler.
    const code = sansCommentaires()
    expect(code).toContain('filename: backup.filename')
    expect(code).toContain('date: formatDate(backup.createdAt)')
    expect(code).toContain('size: formatFileSize(backup.size)')
  })

  it('demande une confirmation rouge, comme la restauration', () => {
    expect(sansCommentaires()).toContain("couleurConfirmer: 'error'")
  })

  it('supprime bien le fichier désigné', () => {
    // Sans ce cas, les précédents seraient satisfaits par une modale parfaite qui n'agit sur rien.
    expect(sansCommentaires()).toContain('agir: () => executeDeleteBackup(backup.filename)')
  })

  it('le libellé français porte les trois substitutions', () => {
    // 📍 Et c'est le cas qui empêche la régression inverse : le code peut passer les trois faits
    // à une phrase qui n'en cite aucun, et la modale n'en afficherait pas plus qu'avant.
    const admin = JSON.parse(
      fs.readFileSync(path.resolve(RACINE, 'apps/app1/i18n/locales/fr/admin.json'), 'utf8')
    ).admin
    for (const jeton of ['{filename}', '{date}', '{size}']) {
      expect(admin.backup_delete_confirm, jeton).toContain(jeton)
    }
  })
})
