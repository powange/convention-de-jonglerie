// Importé explicitement plutôt que pris dans l'auto-import de Nitro : ce fichier est couvert par
// le projet de tests UNITAIRE, qui n'installe aucun global. Sans cet import, la garde échouerait
// sur « createError is not defined » au lieu de rendre son refus.
import { createError } from 'h3'

import {
  coordonneeBancaireOuNull,
  LONGUEUR_MAX_BIC,
  LONGUEUR_MAX_IBAN,
} from '~~/shared/utils/coordonnees-bancaires'

/**
 * Normaliser l'IBAN et le BIC reçus d'un client, et refuser ce que la base ne peut pas écrire.
 *
 * ⚠️ UN SEUL ENDROIT POUR TROIS POINTS D'API. Les coordonnées bancaires d'un artiste s'écrivent
 * depuis la création d'un artiste, depuis sa fiche de gestion, et depuis son propre espace. Trois
 * copies de la même normalisation auraient fini par diverger — et une divergence ici ne se voit
 * pas : elle produit deux valeurs différentes pour le même compte, qu'on ne compare jamais.
 *
 * 📍 NE REND QUE LES CLÉS PRÉSENTES. C'est le point délicat. Rendre `{ iban: null, bic: null }`
 * quand le corps n'en parle pas effacerait les coordonnées à chaque enregistrement d'un autre
 * champ de la fiche — une perte silencieuse, et d'une donnée que la personne devrait alors
 * reconfier. Un champ absent n'est pas un champ vidé ; seul un `null` explicite efface.
 */
export function coordonneesBancairesRecues(donnees: {
  iban?: string | null
  bic?: string | null
}): { iban?: string | null; bic?: string | null } {
  const retenues: { iban?: string | null; bic?: string | null } = {}

  if ('iban' in donnees) {
    const iban = coordonneeBancaireOuNull(donnees.iban)
    if (iban && iban.length > LONGUEUR_MAX_IBAN) {
      throw createError({
        status: 400,
        message: `L'IBAN ne peut pas dépasser ${LONGUEUR_MAX_IBAN} caractères`,
      })
    }
    retenues.iban = iban
  }

  if ('bic' in donnees) {
    const bic = coordonneeBancaireOuNull(donnees.bic)
    if (bic && bic.length > LONGUEUR_MAX_BIC) {
      throw createError({
        status: 400,
        message: `Le BIC ne peut pas dépasser ${LONGUEUR_MAX_BIC} caractères`,
      })
    }
    retenues.bic = bic
  }

  return retenues
}
