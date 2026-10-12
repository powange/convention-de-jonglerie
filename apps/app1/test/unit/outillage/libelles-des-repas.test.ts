import fs from 'node:fs'
import path from 'node:path'

import { describe, it, expect } from 'vitest'

/**
 * Les écrans de repas ne portent plus de libellé français en dur — constat F1.
 *
 * ## Le défaut
 *
 * Le comptoir de validation construisait son pluriel à la main, **quatre fois** :
 * `restant{{ total - validated > 1 ? 's' : '' }}`. Et la barre de génération des documents de
 * restauration nommait les trois phases en français dans le code : `(Montage)`, `(Événement)`,
 * `(Démontage)`. Le site se traduit en treize langues ; ces huit libellés en sortaient.
 *
 * ## Pourquoi une garde de source, et pas la confiance en l'outillage
 *
 * ⚠️ `check-i18n` sait détecter les textes en dur dans les fichiers Vue (son étape 4) — mais **il
 * n'est lancé par aucun workflow de CI**. Rien n'empêcherait donc ces libellés de revenir, et rien
 * ne le dirait. Les douze autres langues reçoivent ces clés par la synchronisation `[TODO]`.
 *
 * ## ⚠️⚠️ CE QUE CETTE GARDE NE PROMET PAS
 *
 * Qu'aucun texte français ne subsiste dans ces deux écrans. Elle surveille **les huit libellés
 * nommés par le constat**, pas une classe de défauts : une garde par motif large y aurait accusé
 * les commentaires, les classes Tailwind et les clés i18n elles-mêmes. La détection générale
 * reste le travail de `check-i18n`.
 */
const RACINE = path.resolve(__dirname, '../../../../..')

const ECRANS = {
  comptoir: 'layers/meals/app/pages/editions/[id]/gestion/meals/validate.vue',
  liste: 'layers/meals/app/pages/editions/[id]/gestion/meals/list.vue',
}

/**
 * Le code d'un écran, **commentaires retirés** — ceux de HTML compris.
 *
 * ⚠️⚠️ SANS CE RETRAIT, LA GARDE ACCUSE LES FICHIERS QUI ONT FAIT LE TRAVAIL : `validate.vue`
 * conserve trois commentaires HTML qui expliquent, en citant « restants », pourquoi l'assiette
 * mise de côté s'affiche en permanence contrairement à ce compteur. Le motif a déjà mordu six fois
 * dans ce dépôt.
 *
 * 📍 Les commentaires de ligne ne sont retirés que lorsqu'ils ne suivent pas un `:` — sans quoi
 * le `//` d'une URL amputerait la fin de sa ligne, et la garde deviendrait aveugle à ce qui la
 * suit.
 */
function codeSansCommentaires(relatif: string): string {
  return fs
    .readFileSync(path.resolve(RACINE, relatif), 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

describe('repas — les libellés des écrans passent par i18n', () => {
  it('le comptoir ne fabrique plus le pluriel de « restant » à la main', () => {
    // L'ancienne forme, littéralement : le mot collé à une interpolation qui décidait du « s ».
    expect(codeSansCommentaires(ECRANS.comptoir)).not.toMatch(/restant\s*\{\{/)
  })

  it('le comptoir emploie la clé de pluriel pour les quatre catégories', () => {
    // Les quatre : bénévoles, artistes, participants, organisateurs. Un compte EXACT, et non un
    // seuil : un seuil ne dirait pas combien de catégories existent, et laisserait l'une d'elles
    // repasser en dur sans rien signaler.
    const occurrences = codeSansCommentaires(ECRANS.comptoir).match(
      /gestion\.meals\.remaining_count/g
    )
    expect(occurrences).toHaveLength(4)
  })

  it('la liste ne nomme plus les trois phases en français', () => {
    const code = codeSansCommentaires(ECRANS.liste)
    for (const libelle of ['(Montage)', '(Événement)', '(Démontage)']) {
      expect(code).not.toContain(libelle)
    }
  })

  it('la liste emploie les trois clés de phase', () => {
    const code = codeSansCommentaires(ECRANS.liste)
    for (const cle of ['phase_setup', 'phase_event', 'phase_teardown']) {
      expect(code).toContain(`gestion.meals.${cle}`)
    }
  })

  it('les quatre clés employées existent bien en français', () => {
    // 📍 Sans ce cas, les précédents seraient satisfaits par une clé inventée : le code citerait
    // un nom que personne n'a traduit, et l'écran afficherait la clé brute au lieu du libellé.
    const fr = JSON.parse(
      fs.readFileSync(path.resolve(RACINE, 'apps/app1/i18n/locales/fr/gestion.json'), 'utf8')
    )
    const repas = fr.gestion.meals
    for (const cle of ['remaining_count', 'phase_setup', 'phase_event', 'phase_teardown']) {
      expect(repas[cle], `gestion.meals.${cle}`).toBeTruthy()
    }
    // La clé de pluriel doit porter ses deux formes, séparées par la barre que vue-i18n attend.
    expect(repas.remaining_count).toContain('|')
  })
})
