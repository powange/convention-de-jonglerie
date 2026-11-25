/**
 * Ce qu'une convention entrepose réellement.
 *
 * Les quantités du stock n'étaient bornées que par « entier positif » : deux milliards
 * d'exemplaires passaient la validation, puis se propageaient dans les calculs de disponibilité et
 * dans l'affichage. Personne n'en saisit autant volontairement — mais un nombre collé par
 * mégarde, un numéro de téléphone dans le mauvais champ, une virgule prise pour un espace, et la
 * fiche affiche une absurdité que rien n'a arrêtée.
 *
 * Dix mille : le plus gros poste d'une convention est de l'ordre du millier — des gobelets
 * réutilisables, des assiettes —, ce qui laisse un ordre de grandeur de marge. Assez haut pour ne
 * jamais gêner une saisie sincère, assez bas pour arrêter une saisie accidentelle.
 *
 * La valeur vit ici, et les sept schémas du module la lisent : sept copies d'un même nombre
 * finiraient par diverger, et c'est alors un seul point d'entrée qui laisserait passer ce que les
 * autres refusent.
 */
export const QUANTITE_MAX_STOCK = 10_000

/** Le message rendu à la saisie, écrit une fois pour les sept schémas. */
export const MESSAGE_QUANTITE_MAX = `La quantité ne peut pas dépasser ${QUANTITE_MAX_STOCK}`
