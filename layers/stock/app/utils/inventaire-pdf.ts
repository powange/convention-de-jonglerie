import { apparenceEmplacement, libelleEmplacement } from './apparence-emplacement'
import { etatEmprunt } from './etat-emprunt'

/**
 * La fiche d'inventaire d'un groupe, préparée pour l'impression.
 *
 * Elle existe pour les moments où l'application ne sert à rien : le hangar sans réseau, le camion
 * qu'on charge, la caisse qu'on ouvre. Ce qu'on emporte sur papier n'est donc pas une copie de
 * l'écran — c'est ce qui aide à retrouver un objet et à noter ce qu'on a trouvé.
 *
 * Ce qui sort du site se décide ici, pas dans le code de mise en page : une fiche imprimée ne se
 * rattrape pas, et la colonne qu'on oublie coûte un aller-retour au local.
 */

/** Un objet, tel que la page le tient. */
export interface ObjetInventaire {
  name: string
  quantity: number
  finalQuantity?: number | null
  location?: string | null
  zone?: { name: string; color: string; zoneTypes?: string[] } | null
  marker?: { name: string; color?: string | null; markerTypes?: string[] } | null
  tags?: Array<{ tag: { name: string } }>
  isExternalLoan?: boolean | null
  pickedUpAt?: string | Date | null
  returnedAt?: string | Date | null
  returnDueAt?: string | Date | null
}

/** Une ligne de la fiche, chaque colonne déjà réduite en texte. */
export interface LigneInventaire {
  nom: string
  /** La quantité théorique, en texte parce qu'une fiche imprimée n'aligne que du texte. */
  quantite: string
  emplacement: string
  tags: string
  /** Clé de traduction de l'état d'emprunt, ou `null` pour du matériel de la convention. */
  etatEmprunt: string | null
  /** La quantité déjà constatée, quand il y en a une. Vide sinon : il reste à compter. */
  compte: string
}

/**
 * Les lignes à imprimer, dans l'ordre reçu.
 *
 * L'ordre est celui de l'écran, et c'est voulu : on parcourt les caisses dans l'ordre où elles
 * sont rangées, et une fiche qui trierait autrement obligerait à chercher chaque ligne.
 *
 * Un objet sans nom est écarté — il n'aurait rien à porter dans la colonne qu'on lit en premier.
 */
export function preparerInventairePourPdf(objets: ObjetInventaire[]): LigneInventaire[] {
  return objets
    .map((objet) => ({
      nom: (objet.name ?? '').trim(),
      quantite: String(objet.quantity ?? 0),
      emplacement: libelleEmplacement(
        apparenceEmplacement(objet.zone ?? null, objet.marker ?? null, objet.location ?? null)
      ),
      // Les tags sur une seule ligne : la colonne est étroite, et deux mots suffisent à
      // reconnaître « fragile » ou « son ».
      tags: (objet.tags ?? []).map((assignation) => assignation.tag.name).join(', '),
      etatEmprunt: etatEmprunt(objet)?.libelle ?? null,
      // Ce qui est déjà compté figure sur la fiche : sans cela, on recompte ce qui l'a été, et
      // l'on ne sait pas distinguer « pas encore vu » de « vu, et il n'en reste rien ».
      compte: typeof objet.finalQuantity === 'number' ? String(objet.finalQuantity) : '',
    }))
    .filter((ligne) => ligne.nom.length > 0)
}

/** Ce que le pied de page rappelle, une fois la fiche détachée de l'écran. */
export interface ResumeInventaire {
  objets: number
  /** Combien portent déjà un comptage. */
  comptes: number
  /** Combien sont empruntés à l'extérieur — ce qu'il faudra rendre. */
  empruntes: number
}

/**
 * De quoi situer la fiche d'un coup d'œil.
 *
 * Le nombre d'emprunts figure à part parce que ce n'est pas du matériel comme les autres : il
 * repart chez quelqu'un, et une fiche qui ne le rappellerait pas laisserait croire que tout ce
 * qu'on range nous appartient.
 */
export function resumeInventaire(lignes: LigneInventaire[]): ResumeInventaire {
  return {
    objets: lignes.length,
    comptes: lignes.filter((ligne) => ligne.compte !== '').length,
    empruntes: lignes.filter((ligne) => ligne.etatEmprunt !== null).length,
  }
}

/**
 * Le nom du fichier proposé au téléchargement.
 *
 * Même forme que la FAQ : accents retirés, ponctuation remplacée par un tiret. Le groupe et
 * l'édition y figurent tous deux — on imprime plusieurs groupes d'affilée, et trois fichiers
 * appelés `inventaire.pdf` dans un dossier de téléchargements ne se distinguent plus.
 */
export function nomFichierInventaire(
  nomGroupe: string | null | undefined,
  nomEdition?: string | null,
  prefixe = 'inventaire'
): string {
  const morceaux = [nomEdition, nomGroupe]
    .map((morceau) =>
      (morceau ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase()
    )
    .filter(Boolean)

  // Composé plutôt qu'écrit d'une pièce : une chaîne pointée littérale se fait prendre pour une
  // clé de traduction par l'analyse i18n, qui la signale alors comme manquante.
  return morceaux.length > 0 ? `${prefixe}-${morceaux.join('-')}.pdf` : `${prefixe}.pdf`
}
