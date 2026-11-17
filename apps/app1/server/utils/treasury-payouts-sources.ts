import type { ElementAVerser } from './treasury-payouts'

/**
 * De quoi se composent les versements à faire : deux mondes, convertis en une seule liste.
 *
 * Les dépenses de trésorerie pointent un bénéficiaire du carnet. Les sommes dues aux artistes —
 * cachets, défraiements, consommables — vivent sur leur fiche d'édition, avec leurs propres
 * drapeaux de paiement et leur propre IBAN. Ce module traduit les deux dans la forme que
 * `versementsAFaire` sait grouper, et c'est tout ce qu'il fait.
 */

/** Une dépense de trésorerie à régler, telle que la base la rend. */
export interface DepenseARegler {
  id: number
  title: string
  montant: number
  code: { code: string; label: string } | null
  payee: { id: number; label: string; iban: string | null; bic: string | null } | null
}

/** Un artiste de l'édition, réduit à ce qu'on peut lui devoir. */
export interface ArtisteAPayer {
  id: number
  nom: string
  iban: string | null
  bic: string | null
  payment: number | null
  paymentPaid: boolean
  reimbursementActual: number | null
  reimbursementActualPaid: boolean
  consumablesActual: number | null
  consumablesActualPaid: boolean
}

/** Les dépenses de trésorerie, traduites. */
export function depensesAVerser(depenses: DepenseARegler[]): ElementAVerser[] {
  return depenses
    .filter((depense) => depense.payee)
    .map((depense) => ({
      cle: `entry:${depense.id}`,
      libelle: depense.title,
      montant: depense.montant,
      code: depense.code,
      destinataire: {
        // Préfixé par origine : sans cela, le bénéficiaire 7 et l'artiste 7 se confondraient dans
        // le regroupement de repli, celui qui s'applique quand il n'y a pas d'IBAN.
        id: `payee:${depense.payee!.id}`,
        label: depense.payee!.label,
        iban: depense.payee!.iban,
        bic: depense.payee!.bic,
        origine: 'payee' as const,
      },
    }))
}

/**
 * Les sommes dues aux artistes, traduites.
 *
 * ## ⚠️ ON NE VIRE PAS UN PLAFOND
 *
 * Un défraiement peut n'être connu que par son **maximum** tant que l'artiste n'a pas remis ses
 * justificatifs. `treasury-compute` le compte alors comme engagé, en notant qu'« un montant issu du
 * plafond ne peut pas être réglé — on ne paie pas une somme qu'on ne connaît pas encore ».
 *
 * La même règle vaut ici, en plus fort : ce module produit des ORDRES DE VIREMENT. Seuls les
 * montants réels y entrent. Un défraiement encore estimé reste dans l'engagé de la trésorerie sans
 * apparaître comme virement à faire — sans quoi on virerait un plafond, et il faudrait ensuite
 * réclamer la différence.
 *
 * ## Les trois sommes sont indépendantes
 *
 * 📍 Un artiste peut avoir touché son cachet mais pas son défraiement. Chaque somme porte son
 * propre drapeau de paiement, et elles sont donc filtrées séparément — les lier ferait réapparaître
 * un montant déjà versé, ou disparaître un montant dû.
 */
export function artistesAVerser(artistes: ArtisteAPayer[]): ElementAVerser[] {
  const elements: ElementAVerser[] = []

  for (const artiste of artistes) {
    const destinataire = {
      id: `artist:${artiste.id}`,
      label: artiste.nom,
      iban: artiste.iban,
      bic: artiste.bic,
      origine: 'artist' as const,
    }

    const sommes: { suffixe: string; libelle: string; montant: number | null; paye: boolean }[] = [
      {
        suffixe: 'payment',
        libelle: 'Cachet',
        montant: artiste.payment,
        paye: artiste.paymentPaid,
      },
      {
        suffixe: 'reimbursement',
        libelle: 'Défraiement',
        // Le montant RÉEL seulement : voir la note ci-dessus. `reimbursementMax` est volontairement
        // ignoré.
        montant: artiste.reimbursementActual,
        paye: artiste.reimbursementActualPaid,
      },
      {
        suffixe: 'consumables',
        libelle: 'Consommables',
        montant: artiste.consumablesActual,
        paye: artiste.consumablesActualPaid,
      },
    ]

    for (const somme of sommes) {
      if (somme.paye || !somme.montant || somme.montant <= 0) continue
      elements.push({
        cle: `artist:${artiste.id}:${somme.suffixe}`,
        libelle: `${somme.libelle} — ${artiste.nom}`,
        montant: somme.montant,
        // Les lignes d'artistes portent leur code d'imputation au niveau de la SOURCE, pas de la
        // ligne : le rattacher ici demanderait de relire les codes de source pour un affichage que
        // l'ordre de virement n'utilise pas.
        code: null,
        destinataire,
      })
    }
  }

  return elements
}
