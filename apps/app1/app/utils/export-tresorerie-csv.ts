import { regrouperParCode, type LigneTresorerie } from './export-tresorerie'

import { versCsv } from '~~/shared/utils/csv'
import { fromCents } from '~~/shared/utils/money'

/**
 * La trésorerie d'une édition, en CSV.
 *
 * Le seul export existant était un PDF structuré par code, fait pour être lu en assemblée générale.
 * Un trésorier ou un expert-comptable qui doit reprendre les écritures dans son propre outil n'avait
 * aucun format réutilisable — alors que chaque ligne porte déjà son code, sa nature, son réglé, son
 * engagé, la personne qui a avancé et son justificatif.
 *
 * **L'ordre des lignes est celui du PDF**, et c'est voulu : `regrouperParCode` range les codes dans
 * l'ordre du plan comptable et referme la marche par les lignes sans code. Deux exports d'une même
 * page qui ne présenteraient pas les lignes dans le même ordre se compareraient mal.
 *
 * Le format, lui, est l'util partagé : `versCsv` porte l'encodage, l'échappement et la garde contre
 * l'injection de formule. Cette garde est **mesurée** et ne doit pas être durcie ici — voir
 * `shared/utils/csv.ts`.
 */

/** Ce que ce fichier sait traduire. Le composant passe son `t`, comme les autres exports. */
type Traducteur = (cle: string, params?: Record<string, unknown>) => string

/**
 * Une ligne telle que la page la détient : `LigneTresorerie` plus ce que le CSV ajoute au PDF.
 *
 * Les champs facultatifs le sont vraiment — une ligne calculée n'a ni justificatif, ni avance, ni
 * identifiant d'entrée.
 */
export interface LigneTresorerieCsv extends LigneTresorerie {
  description?: string | null
  isForecast?: boolean
  reimbursed?: boolean
  imageUrl?: string | null
  origin?: 'source' | 'manual'
  advancedBy?: { pseudo?: string | null } | null
  advancedByName?: string | null
}

/**
 * Les colonnes du fichier, dans l'ordre, avec la clé de leur libellé.
 *
 * Une liste déclarée plutôt que deux tableaux parallèles : l'en-tête et la valeur se lisaient sinon
 * à deux endroits, et rien n'empêcherait qu'ils se décalent d'un cran.
 */
export const COLONNES_TRESORERIE = [
  { id: 'nature', cle: 'gestion.treasury.entry_kind' },
  { id: 'code', cle: 'gestion.treasury.entry_code' },
  { id: 'libelleCode', cle: 'gestion.treasury.export_code_label' },
  { id: 'intitule', cle: 'gestion.treasury.entry_title' },
  { id: 'description', cle: 'common.description' },
  { id: 'engage', cle: 'gestion.treasury.export_engaged' },
  { id: 'regle', cle: 'gestion.treasury.export_settled' },
  { id: 'previsionnel', cle: 'gestion.treasury.entry_forecast' },
  { id: 'avancePar', cle: 'gestion.treasury.entry_advanced_by' },
  { id: 'rembourse', cle: 'gestion.treasury.entry_reimbursed' },
  { id: 'origine', cle: 'gestion.treasury.export_origin' },
  { id: 'justificatif', cle: 'gestion.treasury.entry_receipt' },
] as const

export function entetesDeLaTresorerie(t: Traducteur): string[] {
  return COLONNES_TRESORERIE.map((colonne) => t(colonne.cle))
}

/**
 * Le nom affiché d'une personne ayant avancé : son pseudo, ou le nom libre quand elle n'a pas de
 * compte. Un seul des deux est renseigné, le serveur s'en assure.
 */
function nomDeLAvance(ligne: LigneTresorerieCsv): string {
  return ligne.advancedBy?.pseudo?.trim() || ligne.advancedByName?.trim() || ''
}

/**
 * Les lignes du fichier, dans l'ordre du PDF.
 *
 * Fonction PURE et exportée pour être testable seule : c'est ici que se joue tout ce qui peut être
 * faux sans qu'on le voie — un montant en centimes livré tel quel, une colonne décalée, un « oui »
 * là où la ligne dit non.
 *
 * Les montants sortent en unité courante à deux décimales, par `fromCents` : un tableur qui reçoit
 * `45000` pour 450 € donne des totaux faux et personne ne s'en aperçoit avant l'assemblée.
 *
 * `titreDeLaLigne` est fourni par l'appelant : les lignes calculées portent une clé i18n et non un
 * libellé, et cet util ne connaît pas les mots de la page.
 */
export function preparerLignesTresorerie(
  lignes: readonly LigneTresorerieCsv[],
  t: Traducteur,
  titreDeLaLigne: (ligne: LigneTresorerieCsv) => string
): string[][] {
  const oui = t('common.yes')
  const non = t('common.no')

  const rangees: string[][] = []

  for (const nature of ['EXPENSE', 'INCOME'] as const) {
    const libelleNature = t(
      nature === 'EXPENSE' ? 'gestion.treasury.expense' : 'gestion.treasury.income'
    )

    for (const groupe of regrouperParCode([...lignes], nature)) {
      for (const ligne of groupe.lignes) {
        const engage = (ligne.settled ?? 0) + (ligne.pending ?? 0)

        rangees.push([
          libelleNature,
          groupe.code,
          groupe.libelle,
          titreDeLaLigne(ligne),
          ligne.description ?? '',
          // `fromCents` rend `null` pour une valeur non finie : le repli à zéro évite un
          // « Cannot read properties of null » au milieu d'un export.
          (fromCents(engage) ?? 0).toFixed(2),
          (fromCents(ligne.settled ?? 0) ?? 0).toFixed(2),
          ligne.isForecast ? oui : non,
          nomDeLAvance(ligne),
          ligne.reimbursed ? oui : non,
          t(
            ligne.origin === 'source'
              ? 'gestion.treasury.export_origin_computed'
              : 'gestion.treasury.export_origin_manual'
          ),
          ligne.imageUrl ?? '',
        ])
      }
    }
  }

  return rangees
}

/** Le fichier complet, prêt à être téléchargé. */
export function tresorerieVersCsv(
  lignes: readonly LigneTresorerieCsv[],
  t: Traducteur,
  titreDeLaLigne: (ligne: LigneTresorerieCsv) => string
): string {
  return versCsv(entetesDeLaTresorerie(t), preparerLignesTresorerie(lignes, t, titreDeLaLigne))
}
