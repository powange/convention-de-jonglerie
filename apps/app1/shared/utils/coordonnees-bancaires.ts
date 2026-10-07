/**
 * IBAN et BIC : normaliser, contrôler, afficher.
 *
 * ⚠️ POURQUOI UN CONTRÔLE, ET NON UN SIMPLE CHAMP DE TEXTE. La panne qu'on redoute ici n'est pas
 * un plantage : c'est un virement parti vers un compte qui n'existe pas, découvert des semaines
 * plus tard par un artiste qui n'a pas été payé. Une faute de frappe dans un IBAN ne se voit pas
 * — vingt-sept caractères sans signification apparente — et la clé de contrôle, elle, la voit.
 *
 * 📍 LE CONTRÔLE NE BLOQUE PAS, et c'est un choix. Bloquer l'enregistrement sur un IBAN jugé
 * invalide retournerait le défaut : un compte hors zone IBAN, ou une forme que ce code ignore,
 * rendrait la fiche impossible à remplir, sans recours. L'avertissement laisse la décision à qui
 * saisit — c'est la personne qui a le papier sous les yeux.
 */

/**
 * Majuscules, sans espaces ni séparateurs.
 *
 * Les IBAN sont imprimés par groupes de quatre, et se recopient avec ces espaces. Les garder
 * ferait de « FR76 3000 … » et de « FR7630 00… » deux valeurs différentes pour le même compte.
 */
export function normaliserCoordonneeBancaire(valeur: string | null | undefined): string {
  return (valeur ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** Vide devient `null` : en base, l'absence se dit `NULL`, pas par une chaîne vide. */
export function coordonneeBancaireOuNull(valeur: string | null | undefined): string | null {
  const normalisee = normaliserCoordonneeBancaire(valeur)
  return normalisee === '' ? null : normalisee
}

/**
 * Les longueurs maximales, celles des colonnes.
 *
 * ⚠️ CE PLAFOND-CI N'EST PAS UN JUGEMENT DE PLAUSIBILITÉ, c'est une contrainte de la base :
 * `iban VARCHAR(34)`, `bic VARCHAR(11)`. Une valeur plus longue ferait échouer l'écriture Prisma
 * avec une erreur illisible pour qui saisit. Elle est donc refusée, là où un IBAN de bonne
 * longueur mais de clé fausse n'est que signalé.
 */
export const LONGUEUR_MAX_IBAN = 34
export const LONGUEUR_MAX_BIC = 11

/** Deux lettres de pays, deux chiffres de clé, puis 11 à 30 caractères alphanumériques. */
const FORME_IBAN = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/

/** Banque (4 lettres), pays (2 lettres), place (2), puis l'agence (3), facultative. */
const FORME_BIC = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/

/**
 * La clé de contrôle de l'IBAN, modulo 97.
 *
 * Les quatre premiers caractères passent à la fin, chaque lettre devient son rang + 9 (A = 10), et
 * le nombre obtenu doit être congru à 1 modulo 97. Il est trop grand pour un entier JavaScript :
 * on le réduit par tranches, ce qui donne le même reste.
 */
function cleDeControleEstJuste(iban: string): boolean {
  const permute = iban.slice(4) + iban.slice(0, 4)

  let reste = 0
  for (const caractere of permute) {
    const valeur = /\d/.test(caractere)
      ? caractere
      : String(caractere.charCodeAt(0) - 'A'.charCodeAt(0) + 10)
    // Concaténer puis réduire : `reste` ne dépasse jamais quatre chiffres, donc jamais la
    // précision d'un entier sûr.
    reste = Number(`${reste}${valeur}`) % 97
  }

  return reste === 1
}

/**
 * L'IBAN est-il plausible : la forme ET la clé de contrôle.
 *
 * Rend `true` pour une valeur VIDE : l'absence de coordonnées n'est pas une erreur de saisie, et
 * c'est le cas de la plupart des artistes. Un appelant qui exige la présence la vérifie lui-même.
 */
export function ibanEstPlausible(valeur: string | null | undefined): boolean {
  const iban = normaliserCoordonneeBancaire(valeur)
  if (iban === '') return true
  return FORME_IBAN.test(iban) && cleDeControleEstJuste(iban)
}

/** Le BIC est-il plausible. Vide compris, pour la même raison que l'IBAN. */
export function bicEstPlausible(valeur: string | null | undefined): boolean {
  const bic = normaliserCoordonneeBancaire(valeur)
  if (bic === '') return true
  return FORME_BIC.test(bic)
}

/**
 * L'IBAN par groupes de quatre, comme sur un relevé.
 *
 * C'est sous cette forme qu'il est imprimé, et la seule sous laquelle on peut le relire caractère
 * par caractère pour le comparer au papier.
 */
export function formaterIbanParGroupes(valeur: string | null | undefined): string {
  return normaliserCoordonneeBancaire(valeur)
    .replace(/(.{4})/g, '$1 ')
    .trim()
}
