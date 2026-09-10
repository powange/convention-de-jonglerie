/**
 * Où en est un emprunt de matériel.
 *
 * Trois temps : convenu mais pas encore récupéré, récupéré, rendu. La règle vit ici parce qu'elle
 * sert à deux écrans — la fiche et la liste d'un groupe — et qu'une subtilité s'y perdrait si
 * chacun la réécrivait : le retard ne concerne que la période où le matériel est chez nous.
 */

/** Un matériel, réduit à ce qui détermine l'état de son emprunt. */
export interface EmpruntObservable {
  isExternalLoan?: boolean | null
  pickedUpAt?: string | Date | null
  returnedAt?: string | Date | null
  returnDueAt?: string | Date | null
}

/** L'état d'un emprunt, tel que l'écran l'annonce. */
export interface EtatEmprunt {
  cle: 'a_recuperer' | 'a_rendre' | 'en_retard' | 'rendu'
  couleur: 'neutral' | 'warning' | 'error' | 'success'
  /** Clé de traduction du libellé. */
  libelle: string
}

/**
 * Rend `null` pour un matériel qui n'est pas emprunté : il n'y a alors pas d'état à annoncer, et
 * inventer un « rendu » par défaut mentirait.
 *
 * Un emprunt qu'on n'est pas allé chercher n'est jamais « en retard » : il n'a pas commencé.
 * C'est ce que la seule lecture de `returnDueAt` faisait dire à tort.
 */
export function etatEmprunt(
  materiel: EmpruntObservable,
  maintenant: Date = new Date()
): EtatEmprunt | null {
  if (!materiel.isExternalLoan) return null

  if (materiel.returnedAt) {
    return { cle: 'rendu', couleur: 'success', libelle: 'gestion.stock.loan_returned' }
  }
  if (!materiel.pickedUpAt) {
    return { cle: 'a_recuperer', couleur: 'neutral', libelle: 'gestion.stock.loan_to_pick_up' }
  }
  if (materiel.returnDueAt && new Date(materiel.returnDueAt).getTime() < maintenant.getTime()) {
    return { cle: 'en_retard', couleur: 'error', libelle: 'gestion.stock.loan_overdue' }
  }
  return { cle: 'a_rendre', couleur: 'warning', libelle: 'gestion.stock.loan_to_return' }
}

/**
 * Un responsable, tel que l'API le rend : un compte, ou rien.
 *
 * Les champs d'avatar suivent le pseudo parce que la liste montre le visage devant le nom — on
 * reconnaît plus vite une tête qu'un pseudo, surtout au moment de charger un camion.
 */
export interface ResponsableEmprunt {
  id?: number
  pseudo: string
  profilePicture?: string | null
  emailHash?: string | null
  updatedAt?: string
}

/** Ce que l'emprunt attend de nous : le lieu où aller, et qui s'en charge. */
export interface EtapeEmprunt {
  lieu: string | null
  /** Le nom à afficher, quelle qu'en soit la source. C'est aussi ce sur quoi la colonne trie. */
  qui: string | null
  /**
   * Le compte, quand c'en est un.
   *
   * Distinct de `qui` parce qu'un responsable peut n'être qu'un texte libre — quelqu'un sans
   * compte sur le site. L'écran a besoin de savoir lequel des deux il tient : on ne met pas
   * d'avatar devant « Marc, le voisin ».
   */
  compte: ResponsableEmprunt | null
}

/**
 * L'étape en cours d'un emprunt : la récupération tant qu'on n'y est pas allé, le retour ensuite.
 *
 * Seule l'étape du moment est rendue. Rappeler où récupérer un matériel déjà chez nous
 * encombrerait la liste sans rien apprendre, et un emprunt rendu n'attend plus rien.
 *
 * Rend `null` quand il n'y a rien à dire — pas un emprunt, déjà rendu, ou aucune indication
 * saisie —, pour que l'écran n'affiche pas une ligne vide sous l'étiquette.
 */
export function prochaineEtapeEmprunt(
  materiel: EmpruntObservable & {
    pickupLocation?: string | null
    pickupResponsible?: ResponsableEmprunt | null
    pickupContact?: string | null
    returnLocation?: string | null
    returnResponsible?: ResponsableEmprunt | null
    returnContact?: string | null
  }
): EtapeEmprunt | null {
  const etat = etatEmprunt(materiel)
  if (!etat || etat.cle === 'rendu') return null

  const versLaRecuperation = etat.cle === 'a_recuperer'
  const lieu = versLaRecuperation ? materiel.pickupLocation : materiel.returnLocation
  const responsable = versLaRecuperation ? materiel.pickupResponsible : materiel.returnResponsible
  const contact = versLaRecuperation ? materiel.pickupContact : materiel.returnContact

  // Le compte d'abord, le texte libre en repli : c'est la même règle qu'à la saisie.
  const compte = responsable?.pseudo ? responsable : null
  const qui = compte?.pseudo || contact || null

  if (!lieu && !qui) return null
  return { lieu: lieu || null, qui, compte }
}

/** Les états qu'un filtre peut retenir, « pas un emprunt » compris. */
export const ETATS_EMPRUNT = ['a_recuperer', 'a_rendre', 'en_retard', 'rendu', 'aucun'] as const
export type CleFiltreEmprunt = (typeof ETATS_EMPRUNT)[number]

/**
 * Le matériel dont l'emprunt est dans l'un des états choisis.
 *
 * L'union et non le cumul, comme pour les tags : un même objet n'a qu'un état, et en exiger deux
 * ne rendrait jamais rien. « aucun » désigne le matériel de la convention, qui n'est pas prêté —
 * sans quoi le filtre ne saurait pas l'isoler.
 *
 * Sans état choisi, rien n'est filtré.
 */
export function filtrerParEtatEmprunt<T extends EmpruntObservable>(
  objets: T[],
  etatsChoisis: string[],
  maintenant: Date = new Date()
): T[] {
  if (etatsChoisis.length === 0) return objets

  return objets.filter((objet) => {
    const etat = etatEmprunt(objet, maintenant)
    return etatsChoisis.includes(etat?.cle ?? 'aucun')
  })
}

/**
 * Les états portés par l'URL, réduits à ceux qui existent.
 *
 * Une valeur inconnue — lien d'une version antérieure, adresse tapée à la main — est écartée
 * plutôt que de filtrer sur un état qui ne correspond à rien et de vider l'écran.
 */
export function etatsDepuisUrl(valeur: unknown): CleFiltreEmprunt[] {
  const brut = Array.isArray(valeur) ? valeur.join(',') : typeof valeur === 'string' ? valeur : ''

  const connus = brut
    .split(',')
    .map((morceau) => morceau.trim())
    .filter((cle): cle is CleFiltreEmprunt => (ETATS_EMPRUNT as readonly string[]).includes(cle))

  return Array.from(new Set(connus))
}

/** La valeur à écrire dans l'URL, ou `undefined` pour retirer le paramètre. */
export function urlDepuisEtats(etats: string[]): string | undefined {
  return etats.length > 0 ? etats.join(',') : undefined
}
