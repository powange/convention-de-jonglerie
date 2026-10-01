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
  /** Le jour où l'argent a bougé, au format ISO. Absent sur les lignes calculées et sur les
   *  entrées antérieures à ce champ. */
  operationDate?: string | null
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
  { id: 'dateOperation', cle: 'gestion.treasury.entry_operation_date' },
  { id: 'description', cle: 'common.description' },
  { id: 'engage', cle: 'gestion.treasury.export_engaged' },
  { id: 'regle', cle: 'gestion.treasury.export_settled' },
  { id: 'previsionnel', cle: 'gestion.treasury.entry_forecast' },
  { id: 'avancePar', cle: 'gestion.treasury.entry_advanced_by' },
  { id: 'rembourse', cle: 'gestion.treasury.entry_reimbursed' },
  { id: 'origine', cle: 'gestion.treasury.export_origin' },
  { id: 'justificatif', cle: 'gestion.treasury.entry_receipt' },
] as const

/** L'identifiant d'une colonne d'export, tel que `COLONNES_TRESORERIE` le déclare. */
export type IdColonneTresorerie = (typeof COLONNES_TRESORERIE)[number]['id']

/**
 * Le rapprochement entre une colonne d'EXPORT et la colonne du TABLEAU qui la montre.
 *
 * ⚠️ UNE COLONNE DE L'ÉCRAN EN COUVRE PLUSIEURS DU FICHIER, et c'est là que se joue le sens :
 * « Code » montre à l'écran un code dont le fichier détaille aussi le libellé, et « Montant »
 * résume ce que le fichier éclate en engagé, réglé et prévisionnel. Masquer « Montant » retire
 * donc TROIS colonnes du fichier — c'est ce que « n'exporter que les colonnes sélectionnées »
 * demande, et il faut en avoir conscience : ce sont les trois colonnes chiffrées.
 *
 * 📍 CE QUI N'EST PAS LISTÉ RESTE EXPORTÉ : la nature, l'origine, le justificatif ou l'avance ne
 * sont pas des colonnes de ce tableau. On ne peut pas les y masquer, donc rien ne justifie de les
 * retirer du fichier.
 */
const COLONNE_DU_TABLEAU: Partial<Record<IdColonneTresorerie, string>> = {
  code: 'code',
  libelleCode: 'code',
  intitule: 'libelle',
  dateOperation: 'date',
  description: 'description',
  engage: 'montant',
  regle: 'montant',
  previsionnel: 'montant',
}

/**
 * Les colonnes d'export que la sélection de l'écran laisse passer.
 *
 * `visibilite` ne liste que les colonnes MASQUÉES — une absente est visible. Voir
 * `colonnes-a-exporter.ts`, qui porte la règle et la raison.
 */
export function colonnesTresorerieVisibles(
  visibilite: Record<string, boolean> | null | undefined
): IdColonneTresorerie[] {
  return COLONNES_TRESORERIE.filter((colonne) => {
    const duTableau = COLONNE_DU_TABLEAU[colonne.id]
    return !duTableau || visibilite?.[duTableau] !== false
  }).map((colonne) => colonne.id)
}

/** Les colonnes retenues, dans l'ordre déclaré. Sans choix, toutes. */
function colonnesRetenues(
  choisies?: readonly IdColonneTresorerie[]
): readonly (typeof COLONNES_TRESORERIE)[number][] {
  if (!choisies) return COLONNES_TRESORERIE
  const voulues = new Set<string>(choisies)
  return COLONNES_TRESORERIE.filter((colonne) => voulues.has(colonne.id))
}

export function entetesDeLaTresorerie(
  t: Traducteur,
  colonnes?: readonly IdColonneTresorerie[]
): string[] {
  return colonnesRetenues(colonnes).map((colonne) => t(colonne.cle))
}

/**
 * La date d'opération, en `AAAA-MM-JJ`.
 *
 * Découpée sur l'ISO en UTC et non formatée pour l'œil : un tableur trie correctement une date
 * ISO, et la rendre dans le fuseau du lecteur la ferait glisser d'un jour à l'ouest de Greenwich.
 * Vide quand la ligne n'en a pas — une ligne calculée, ou une entrée antérieure au champ.
 */
function dateDOperationIso(valeur?: string | null): string {
  return valeur ? new Date(valeur).toISOString().slice(0, 10) : ''
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
/**
 * Les index des colonnes retenues, dans l'ordre de `COLONNES_TRESORERIE`.
 *
 * ⚠️ PROJECTION PAR INDEX, et c'est volontaire : chaque rangée est construite positionnellement,
 * case par case, dans l'ordre exact de `COLONNES_TRESORERIE`. Filtrer par index garantit donc
 * l'alignement entre en-têtes et valeurs — là où deux filtrages séparés laisseraient le fichier
 * décalé d'un cran, ce qui ne se voit qu'à l'ouverture.
 */
function indexDesColonnes(choisies?: readonly IdColonneTresorerie[]): number[] | null {
  if (!choisies) return null
  const voulues = new Set<string>(choisies)
  return COLONNES_TRESORERIE.map((colonne, index) => (voulues.has(colonne.id) ? index : -1)).filter(
    (index) => index >= 0
  )
}

export function preparerLignesTresorerie(
  lignes: readonly LigneTresorerieCsv[],
  t: Traducteur,
  titreDeLaLigne: (ligne: LigneTresorerieCsv) => string,
  colonnes?: readonly IdColonneTresorerie[]
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
          dateDOperationIso(ligne.operationDate),
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

  const index = indexDesColonnes(colonnes)
  if (!index) return rangees
  return rangees.map((rangee) => index.map((position) => rangee[position] ?? ''))
}

/** Le fichier complet, prêt à être téléchargé. */
export function tresorerieVersCsv(
  lignes: readonly LigneTresorerieCsv[],
  t: Traducteur,
  titreDeLaLigne: (ligne: LigneTresorerieCsv) => string,
  colonnes?: readonly IdColonneTresorerie[]
): string {
  // La MÊME liste des deux côtés : la passer à l'un et pas à l'autre décalerait tout le fichier.
  return versCsv(
    entetesDeLaTresorerie(t, colonnes),
    preparerLignesTresorerie(lignes, t, titreDeLaLigne, colonnes)
  )
}
