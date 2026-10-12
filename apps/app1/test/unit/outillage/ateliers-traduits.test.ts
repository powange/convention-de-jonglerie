import fs from 'node:fs'
import path from 'node:path'

import { describe, it, expect } from 'vitest'

/**
 * La page publique des ateliers ne porte plus de français en dur — constat F1 des petits modules.
 *
 * ## Le défaut
 *
 * La liste était traduite, mais pas le reste : la modale d'ajout et de modification (titre,
 * sous-titre, libellés, substituts de saisie, boutons), « Proposé par », la période de l'édition,
 * les quatre messages de validation des dates, la durée calculée et les sept toasts des
 * `useApiAction` étaient écrits en français **dans le code**. Et les trois formateurs de date
 * passaient la locale **`'fr-FR'` figée** : un lecteur anglophone voyait « samedi 1 août » au
 * milieu d'une page en anglais, sur un site traduit en treize langues.
 *
 * ## ⚠️ POURQUOI UNE GARDE, alors que l'outillage existe
 *
 * `check-i18n` a **son étape 4 pour les textes en dur, et elle n'a rien vu de tout cela** : ces
 * libellés vivaient dans des interpolations (`{{ x ? 'Modifier' : 'Ajouter' }}`), dans des objets
 * d'options (`successMessage: { title: '…' }`) et dans des gabarits de chaîne du script — trois
 * formes que ce détecteur ne couvre pas. Et il **n'est de toute façon lancé par aucun workflow de
 * CI**. Il n'y avait donc rien du tout pour empêcher le retour de ces chaînes.
 *
 * ## ⚠️⚠️ CE QUE CETTE GARDE N'EST PAS
 *
 * Une garde de **source** : elle lit le texte de la page et **ne monte rien**. Elle ne prouve donc
 * pas ce qui s'affiche, et elle ne prouve pas non plus qu'il ne reste *aucun* français — elle
 * surveille les chaînes nommées par le constat et la locale des trois formateurs. Un motif large
 * accuserait ici les commentaires, qui sont en français par convention dans ce dépôt.
 *
 * 📍 Ce qui EST volontairement resté en l'état : les cinq raccourcis de durée (« 30min », « 1h »,
 * « 1h30 »…). C'est une notation, pas une phrase, et le constat ne les nommait pas.
 */
const RACINE = path.resolve(__dirname, '../../../../..')
const PAGE = 'layers/workshops/app/pages/editions/[id]/workshops/index.vue'

/** Le code de la page, commentaires retirés — ceux de HTML compris. */
function sansCommentaires(): string {
  return fs
    .readFileSync(path.resolve(RACINE, PAGE), 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/** Les chaînes que le constat nomme, et qui ne doivent plus être écrites dans le code. */
const CHAINES_PROSCRITES = [
  'Modifier le workshop',
  'Ajouter un workshop',
  'Modifiez les informations du workshop',
  'Créez un nouveau workshop pour les participants',
  'Nom du workshop',
  'Horaires du workshop',
  "Période de l'édition",
  'Durée rapide',
  'Nombre de participants',
  'Maximum de participants',
  'Laisser vide pour autoriser',
  'Proposé par',
  'Le workshop ne peut pas commencer',
  'La date de fin doit être après',
  '1 heure',
  'Workshop ajouté avec succès',
  'Workshop modifié avec succès',
  'Workshop supprimé avec succès',
  'Erreur lors du chargement des workshops',
  'Erreur lors de la sauvegarde',
  'Erreur lors de la suppression',
]

/** Les clés que la page cite et qui doivent exister en français. */
const CLES_CITEES = [
  'add_workshop',
  'add_workshop_description',
  'description_long_placeholder',
  'duration_days',
  'duration_hours',
  'duration_hours_minutes',
  'duration_minutes',
  'edit_workshop',
  'edit_workshop_description',
  'edition_period',
  'error_deleting',
  'error_end_after_edition',
  'error_end_before_start',
  'error_loading_workshops',
  'error_saving',
  'error_start_after_edition',
  'error_start_before_edition',
  'max_participants_hint',
  'max_participants_optional',
  'participants_title',
  'proposed_by',
  'quick_duration',
  'schedule_title',
  'title_name_placeholder',
  'unlimited',
  'workshop_added',
  'workshop_deleted',
  'workshop_description',
  'workshop_title',
  'workshop_updated',
]

describe('ateliers — la page publique ne parle plus français dans son code', () => {
  it.each(CHAINES_PROSCRITES)('« %s » n’est plus écrite dans le code', (chaine) => {
    expect(sansCommentaires()).not.toContain(chaine)
  })

  it("ne fige plus la locale des dates sur 'fr-FR'", () => {
    // Le défaut le plus discret du constat : la page pouvait être entièrement traduite et
    // continuer d'écrire ses dates en français.
    expect(sansCommentaires()).not.toContain("'fr-FR'")
  })

  it('les trois formateurs prennent la locale du lecteur', () => {
    // Un compte EXACT, et non un seuil : un seuil ne dirait pas combien de formateurs existent,
    // et laisserait l'un d'eux repasser sur une locale figée sans rien signaler.
    const code = sansCommentaires()
    expect(code.match(/fuseau\.value, locale\.value/g)).toHaveLength(3)
    expect(code).toContain('const { t: $t, locale } = useI18n()')
  })

  it('les trente clés citées existent en français', () => {
    // 📍 Sans ce cas, tous les précédents seraient satisfaits par des clés inventées : la page
    // afficherait « workshops.schedule_title » à la place du libellé, et la garde serait verte.
    const fr = JSON.parse(
      fs.readFileSync(path.resolve(RACINE, 'apps/app1/i18n/locales/fr/workshops.json'), 'utf8')
    )
    const ateliers = fr.workshops
    for (const cle of CLES_CITEES) {
      expect(ateliers[cle], `workshops.${cle}`).toBeTruthy()
    }
  })

  it('les clés citées le sont vraiment par la page', () => {
    // L'inverse du cas précédent : une clé de cette liste qui aurait disparu de la page laisserait
    // la garde surveiller du vide. Les trois clés de `common` ne sont pas dans `CLES_CITEES`,
    // puisqu'elles ne vivent pas dans le domaine des ateliers.
    const code = sansCommentaires()
    for (const cle of CLES_CITEES) {
      expect(code, `workshops.${cle}`).toContain(`workshops.${cle}`)
    }
    for (const cle of ['common.cancel', 'common.edit', 'common.add']) {
      expect(code, cle).toContain(cle)
    }
  })

  it('les deux clés de durée au pluriel portent leurs deux formes', () => {
    const fr = JSON.parse(
      fs.readFileSync(path.resolve(RACINE, 'apps/app1/i18n/locales/fr/workshops.json'), 'utf8')
    )
    // La barre que vue-i18n attend. Sans elle, « 2 heure » et « 3 jour ».
    expect(fr.workshops.duration_hours).toContain('|')
    expect(fr.workshops.duration_days).toContain('|')
  })
})
