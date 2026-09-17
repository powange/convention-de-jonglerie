/**
 * « De quelle personne le guichet parle-t-il, et l'a-t-elle prouvé ? »
 *
 * Le contrôle d'accès atteint une personne de deux façons, qui n'ont pas du tout le même degré de
 * confiance — et les confondre était un défaut réel :
 *
 * 1. **Un QR code scanné**, au format `genre-{id}-{jeton}`. L'entrée est celle que présente la
 *    personne : rien n'y est acquis, et le jeton est la seule chose qui distingue son billet de
 *    celui du voisin. Les identifiants sont des entiers séquentiels — les essayer un par un n'est
 *    pas une attaque, c'est une boucle. **Le jeton est donc exigé, sans exception.**
 * 2. **Une relecture par l'écran de gestion**, qui rouvre une fiche DÉJÀ affichée après avoir
 *    validé ou dévalidé l'entrée. Là, l'identifiant vient de la réponse précédente du serveur, et
 *    la personne aux commandes a déjà prouvé son droit — le même que celui qui lui permet de
 *    trouver n'importe qui par son nom via `search.post.ts`, sans aucun jeton. Exiger le jeton ici
 *    n'apporterait rien et obligerait l'écran à le transporter.
 *
 * Auparavant les deux passaient par le même champ `qrCode`, et le jeton n'était vérifié
 * **que s'il était présent** : `...(token && { qrCodeToken: token })`. L'écran de gestion
 * fabriquait un faux QR code sans jeton pour se relire, ce qui obligeait le scan à accepter cette
 * forme — et un `volunteer-42` tapé à la main entrait donc au même titre.
 *
 * La correction ne consiste pas à ajouter une vérification : elle consiste à **séparer les deux
 * demandes**, pour que le cas de confiance n'ait plus besoin d'emprunter la porte du cas sans
 * confiance. C'est pour cela que `preuve` est un objet à étaler tel quel dans le `where`, et non
 * un jeton éventuellement nul : il n'y a plus de condition à écrire du côté de l'appelant, donc
 * plus de condition à oublier.
 */

/** Les trois populations que le guichet reconnaît à un QR code, en plus des billets. */
export type GenreDePersonne = 'volunteer' | 'artist' | 'organizer'

/**
 * Ce qui s'ajoute au `where` Prisma pour prouver l'identité.
 *
 * Un objet vide n'est PAS un oubli : c'est le cas où la preuve a été faite ailleurs, par le droit
 * de la personne qui interroge. Aucun appelant n'a donc à décider s'il faut filtrer.
 */
export type PreuveDIdentite = { qrCodeToken: string } | Record<string, never>

/** Ce que le point d'API accepte : un QR code présenté, ou une personne déjà connue. */
export type DemandeDeLecture = { qrCode: string } | { type: GenreDePersonne; id: number }

export type Designation =
  | { genre: GenreDePersonne; id: number; preuve: PreuveDIdentite }
  /** Tout ce qui ne porte aucun des trois préfixes : le code d'un billet, quel que soit sa forme. */
  | { genre: 'ticket'; qrCode: string }
  | { genre: 'refus'; message: string }

const LIBELLES: Record<GenreDePersonne, string> = {
  volunteer: 'bénévole',
  artist: 'artiste',
  organizer: 'organisateur',
}

const PREFIXES: Array<[GenreDePersonne, string]> = [
  ['volunteer', 'volunteer-'],
  ['artist', 'artist-'],
  ['organizer', 'organizer-'],
]

export function designerLaPersonne(demande: DemandeDeLecture): Designation {
  // La relecture par l'écran de gestion : l'identifiant vient de nous, pas de la personne.
  if ('type' in demande) {
    return { genre: demande.type, id: demande.id, preuve: {} }
  }

  for (const [genre, prefixe] of PREFIXES) {
    if (!demande.qrCode.startsWith(prefixe)) continue

    const morceaux = demande.qrCode.slice(prefixe.length).split('-')
    const id = Number.parseInt(morceaux[0] ?? '', 10)
    if (Number.isNaN(id)) {
      return { genre: 'refus', message: `QR code ${LIBELLES[genre]} invalide` }
    }

    const jeton = morceaux[1]
    if (!jeton) {
      // Le format `genre-{id}` a existé, et plus aucune ligne de la base n'en dépend : toutes
      // portent un jeton. L'accepter ne servirait donc qu'à laisser entrer qui l'a deviné.
      return {
        genre: 'refus',
        message:
          'Ce QR code est à un format qui n’est plus accepté. Demandez à la personne de rouvrir ' +
          'son billet depuis l’application pour en afficher un nouveau.',
      }
    }

    return { genre, id, preuve: { qrCodeToken: jeton } }
  }

  return { genre: 'ticket', qrCode: demande.qrCode }
}
