import { normaliserCoordonneeBancaire } from '#core/shared/utils/coordonnees-bancaires'

/**
 * Les versements à faire : ce que l'édition doit à des TIERS.
 *
 * ## ⚠️ À NE PAS CONFONDRE AVEC LES AVANCES
 *
 * `avancesARembourser` (dans `treasury-compute.ts`) totalise ce que l'édition doit à des gens de
 * son équipe, qui ont payé de leur poche. Ce module-ci totalise ce qu'elle doit à des tiers
 * extérieurs, qui attendent un virement.
 *
 * Les deux se paient souvent de la même façon, et les confondre fait payer deux fois ou pas du
 * tout. L'invariant posé au lot précédent garantit qu'une ligne n'appartient jamais aux deux :
 * une dépense est soit avancée, soit à régler.
 *
 * ⚠️ Le code existant appelle `parBeneficiaire` le regroupement DES AVANCES. Le mot est donc pris,
 * et c'est pourquoi on parle ici de « versements » et de « destinataires ».
 */

/** Une dépense qui attend son virement. */
export interface LigneAVerser {
  cle: string
  libelle: string
  /** Montant dû, en centimes : réglé ET engagé confondus — voir la note du regroupement. */
  montant: number
  code: { code: string; label: string } | null
}

/** Un destinataire et ce qu'on lui doit. */
export interface DestinataireDeVersement {
  /** La clé de regroupement : l'IBAN normalisé s'il existe, sinon l'identité du destinataire. */
  cle: string
  destinataireId: string
  label: string
  iban: string | null
  bic: string | null
  /** `mixte` quand un même compte reçoit à la fois une facture et une somme due à un artiste. */
  origine: 'payee' | 'artist' | 'mixte'
  montant: number
  lignes: LigneAVerser[]
}

export interface VersementsAFaire {
  total: number
  destinataires: DestinataireDeVersement[]
}

/** Un destinataire déjà résolu : d'où qu'il vienne, le regroupement n'a besoin que de cela. */
export interface DestinataireResolu {
  /** Identité de repli quand il n'y a pas d'IBAN. Préfixée par origine : `payee:7`, `artist:12`. */
  id: string
  label: string
  iban: string | null
  bic: string | null
  /** D'où vient ce montant, pour que l'écran puisse le dire. */
  origine: 'payee' | 'artist'
}

/** Un montant à verser, son destinataire déjà résolu. */
export interface ElementAVerser {
  cle: string
  libelle: string
  montant: number
  code: { code: string; label: string } | null
  destinataire: DestinataireResolu
}

/**
 * Regroupe les montants à verser, par destinataire.
 *
 * ## ⚠️ DEUX ORIGINES, UN SEUL REGROUPEMENT
 *
 * Les montants viennent de deux mondes qui ne se ressemblent pas : les dépenses de trésorerie
 * pointant un bénéficiaire du carnet, et les sommes dues aux artistes — cachets, défraiements,
 * consommables — qui vivent sur leur fiche d'édition avec leurs propres drapeaux de paiement.
 *
 * Ils sont résolus AVANT d'arriver ici, en `DestinataireResolu`. Cette fonction ne sait donc rien
 * de l'un ni de l'autre : elle groupe, additionne et trie. Y faire entrer la connaissance des deux
 * modèles l'aurait rendue impossible à éprouver sans les deux à la fois.
 *
 * ## La clé de regroupement
 *
 * 📍 L'IBAN NORMALISÉ quand il existe, et non l'identité du destinataire — et c'est ce qui fait
 * qu'un artiste et un prestataire partageant un compte reçoivent UN virement. Deux fiches
 * distinctes peuvent porter le même IBAN : un prestataire saisi deux fois, ou un collectif qui
 * facture pour l'un de ses membres.
 *
 * Sans IBAN, on retombe sur l'identité : deux destinataires sans coordonnées restent séparés,
 * faute de quoi on les fusionnerait sur la foi d'une homonymie.
 */
export function versementsAFaire(elements: ElementAVerser[]): VersementsAFaire {
  const parDestinataire = new Map<string, DestinataireDeVersement>()

  for (const element of elements) {
    // Un montant nul n'est pas un virement : l'afficher ferait chercher une erreur qui n'existe pas.
    if (element.montant <= 0) continue

    const iban = element.destinataire.iban
      ? normaliserCoordonneeBancaire(element.destinataire.iban)
      : null
    const cle = iban ? `i:${iban}` : `d:${element.destinataire.id}`

    /*
     * ⚠️ LES LIGNES SONT COLLECTÉES ICI, dans la boucle qui applique déjà la règle — et non
     * regroupées une seconde fois côté client. Un détail qui ne somme pas à son propre total ne se
     * remarque qu'en recomptant à la main.
     */
    const ligne: LigneAVerser = {
      cle: element.cle,
      libelle: element.libelle,
      montant: element.montant,
      code: element.code,
    }

    const deja = parDestinataire.get(cle)
    if (deja) {
      deja.montant += element.montant
      deja.lignes.push(ligne)
      /*
       * 📍 Un destinataire regroupé sur son IBAN peut venir des DEUX origines. On retient alors
       * « mixte », pour que l'écran ne prétende pas que ce virement est seulement celui d'un
       * artiste alors qu'il solde aussi une facture.
       */
      if (deja.origine !== element.destinataire.origine) deja.origine = 'mixte'
      continue
    }
    parDestinataire.set(cle, {
      cle,
      destinataireId: element.destinataire.id,
      label: element.destinataire.label,
      iban,
      bic: element.destinataire.bic,
      origine: element.destinataire.origine,
      montant: element.montant,
      lignes: [ligne],
    })
  }

  const destinataires = [...parDestinataire.values()].sort((a, b) => b.montant - a.montant)
  // Le même ordre à l'intérieur qu'à l'extérieur : le plus gros montant d'abord, c'est celui qu'on
  // vérifie en premier quand on contrôle une somme.
  for (const destinataire of destinataires) {
    destinataire.lignes.sort((a, b) => b.montant - a.montant)
  }

  return {
    total: destinataires.reduce((somme, d) => somme + d.montant, 0),
    destinataires,
  }
}
