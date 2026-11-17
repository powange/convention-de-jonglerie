import { createError } from 'h3'

import {
  coordonneeBancaireOuNull,
  LONGUEUR_MAX_BIC,
  LONGUEUR_MAX_IBAN,
} from '~~/shared/utils/coordonnees-bancaires'

/**
 * Le carnet des bénéficiaires d'une édition : à qui l'on doit verser de l'argent.
 *
 * ⚠️ Rattaché à l'ÉDITION et non à la convention, à la différence du plan comptable qui se réutilise
 * d'une année sur l'autre. C'est la même décision que pour les coordonnées bancaires d'un artiste,
 * et pour la même raison : un IBAN confié aux organisateurs d'une édition serait autrement lisible
 * par ceux de toutes les autres, sans que son titulaire l'ait jamais accepté.
 */

/** Ce que l'écran reçoit pour chaque bénéficiaire. */
export interface BeneficiairePourEcran {
  id: number
  label: string
  iban: string | null
  bic: string | null
  notes: string | null
}

/**
 * Le nombre de bénéficiaires qu'une édition peut garder.
 *
 * Généreux à dessein : une convention qui règle trente prestataires est plausible. Le plafond
 * n'est là que pour qu'une boucle fautive ou un collage répété ne remplisse pas la table en
 * silence — pas pour contraindre un usage réel.
 */
export const MAX_BENEFICIAIRES_PAR_EDITION = 200

/**
 * Normalise l'IBAN et le BIC reçus d'un client, et refuse ce que la base ne peut pas écrire.
 *
 * ⚠️ NE REND QUE LES CLÉS PRÉSENTES, exactement comme `coordonnees-bancaires-recues.ts` le fait
 * pour les artistes. Rendre `{ iban: null, bic: null }` quand le corps n'en parle pas effacerait
 * les coordonnées à chaque modification d'un autre champ — une perte silencieuse, et d'une donnée
 * que la personne devrait alors reconfier. Un champ absent n'est pas un champ vidé ; seul un
 * `null` explicite efface.
 *
 * 📍 La normalisation (majuscules, sans espaces) n'est pas cosmétique : c'est elle qui permettra au
 * regroupement des versements de reconnaître deux saisies du même compte. Sans elle,
 * « FR76 1234 » et « fr7612 34 » produiraient deux virements au lieu d'un.
 */
export function coordonneesBancairesDuBeneficiaire(donnees: {
  iban?: string | null
  bic?: string | null
}): { iban?: string | null; bic?: string | null } {
  const resultat: { iban?: string | null; bic?: string | null } = {}

  if ('iban' in donnees) {
    const iban = coordonneeBancaireOuNull(donnees.iban)
    if (iban && iban.length > LONGUEUR_MAX_IBAN) {
      throw createError({
        status: 400,
        message: `IBAN trop long (max ${LONGUEUR_MAX_IBAN} caractères)`,
      })
    }
    resultat.iban = iban
  }

  if ('bic' in donnees) {
    const bic = coordonneeBancaireOuNull(donnees.bic)
    if (bic && bic.length > LONGUEUR_MAX_BIC) {
      throw createError({
        status: 400,
        message: `BIC trop long (max ${LONGUEUR_MAX_BIC} caractères)`,
      })
    }
    resultat.bic = bic
  }

  return resultat
}

/** Les bénéficiaires d'une édition, par libellé. */
export async function listerBeneficiaires(editionId: number): Promise<BeneficiairePourEcran[]> {
  return prisma.treasuryPayee.findMany({
    where: { editionId },
    orderBy: { label: 'asc' },
    select: { id: true, label: true, iban: true, bic: true, notes: true },
  })
}
