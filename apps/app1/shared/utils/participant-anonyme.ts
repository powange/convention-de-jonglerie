/**
 * Le nom de remplissage posé sur un participant qu'on n'a pas nommé.
 *
 * ⚠️ POURQUOI IL EST NOMMÉ ICI PLUTÔT QU'ÉCRIT EN DUR. Il était écrit en dur dans
 * `AddParticipantModal.vue`, et il décide pourtant d'une question d'argent : au guichet, savoir si
 * une commande annulée concerne UNE personne ou PLUSIEURS tranche entre rendre la somme entière et
 * la rendre ligne par ligne.
 *
 * Mesuré sur la base de développement, les deux formes existent côte à côte :
 * • commande 937 — « Anne Claire Durand » et quatre lignes « Anonyme Anonyme » : une seule
 *   personne, qui a aussi pris des repas ;
 * • commande 686 — « Virgil SORMAIL », « Eloïne SORMAIL », « MaryLou LE ROUX » : trois personnes
 *   réelles sous un même e-mail de payeur.
 *
 * 📍 L'E-MAIL NE SÉPARE RIEN : les deux commandes n'en portent qu'un, celui de qui a payé. Ce qui
 * distingue les deux cas est exactement ce nom de remplissage.
 */
export const NOM_PARTICIPANT_ANONYME = 'Anonyme'

/** Cette ligne désigne-t-elle quelqu'un, ou n'a-t-elle simplement pas été nommée ? */
export function ligneSansTitulaire(personne: {
  firstName?: string | null
  lastName?: string | null
}): boolean {
  const prenom = (personne.firstName ?? '').trim()
  const nom = (personne.lastName ?? '').trim()
  if (!prenom && !nom) return true
  // Comparaison insensible à la casse : le remplissage est écrit par l'écran, pas par la base.
  const anonyme = NOM_PARTICIPANT_ANONYME.toLowerCase()
  return prenom.toLowerCase() === anonyme && nom.toLowerCase() === anonyme
}
