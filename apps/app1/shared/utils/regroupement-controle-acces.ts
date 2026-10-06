import { cleDeBoiteDeReception } from './adresse-email'
import { normaliserTexte } from './recherche-texte'

/**
 * Rapprocher les titres d'une même personne, au contrôle d'accès.
 *
 * Une personne peut porter plusieurs titres sur une édition : un billet acheté en ligne, une
 * candidature de bénévole, une fiche d'artiste, une place d'organisateur. Chacun porte son propre
 * drapeau de validation, dans sa propre table — on devait donc chercher la personne autant de fois
 * qu'elle avait de titres.
 *
 * Ce module CONSTATE le rapprochement ; il ne valide rien et ne fusionne aucune donnée. L'écran
 * propose, un humain tranche — même philosophie que `doublons-utilisateurs`, et pour la même
 * raison : ici une erreur fait valider l'entrée de quelqu'un qui n'est pas là.
 *
 * ⚠️ LA CLÉ A ÉTÉ CHOISIE SUR MESURE, PAS PAR INTUITION. Relevé le 06/10/2026 en base de
 * développement, sur 1685 billets :
 *
 * - **609 courriels** portent des billets, et **163 d'entre eux — 27 % — portent des billets à
 *   PLUSIEURS NOMS**. Le pire en porte **63** : une association qui achète pour son groupe sous
 *   une seule adresse. Grouper par courriel seul aurait donc fusionné à tort un quart des cas.
 * - seuls **319 billets (19 %)** ont un courriel correspondant à un compte : grouper par compte
 *   seul aurait manqué quatre billets sur cinq.
 * - **84 personnes** cumulent un billet et un autre titre : c'est la population servie.
 * - **un seul** billet sur 1685 porte un courriel différent de celui du payeur, et **aucun** n'est
 *   sans courriel. Ces deux craintes étaient théoriques : on n'encombre pas l'écran pour elles.
 *
 * D'où la clé : **le compte quand il existe** — certain —, et pour un billet **la boîte de
 * réception ET le nom**. C'est l'exigence du nom qui rend l'usage d'une clé de boîte large
 * (alias `+`, points Google) sans danger.
 */

/**
 * Pourquoi deux titres ont été rapprochés. Affiché, pour qu'un humain puisse juger.
 *
 * ⚠️ NE PAS LE RENOMMER « motif de rapprochement » : ce nom est déjà pris par
 * `doublons-utilisateurs`, et l'auto-import de Nuxt n'en garde qu'UN. Il l'annonce en
 * avertissement au démarrage — « Duplicated imports » —, puis le fichier qui croyait importer
 * l'autre reçoit celui-ci en silence. Les deux notions sont voisines mais distinctes : là-bas on
 * rapproche deux COMPTES, ici les TITRES d'une même personne.
 */
export type MotifDeRegroupement =
  /** Même compte utilisateur : certain. */
  | 'compte'
  /** Même boîte de réception et même nom : très probable, mais à confirmer. */
  | 'courriel-et-nom'

export type NatureDeTitre = 'ticket' | 'volunteer' | 'artist' | 'organizer'

/** Le minimum qu'un titre doit porter pour être rapproché. */
export interface TitreRapprochable {
  nature: NatureDeTitre
  /** Identifiant dans SA table — c'est lui qu'on enverra valider. */
  id: number
  /** Le compte, quand le titre en a un. Les billets n'en ont pas. */
  userId?: number | null
  email?: string | null
  prenom?: string | null
  nom?: string | null
  /** Déjà validé ? Sert à l'écran, pas au rapprochement. */
  entryValidated?: boolean
}

export interface PersonneRapprochee {
  /** Clé stable d'un rendu à l'autre : `compte:12` ou `courriel:xxx|nom:yyy`. */
  cle: string
  motif: MotifDeRegroupement
  /** Le nom à afficher : celui du premier titre qui en porte un. */
  libelle: string
  titres: TitreRapprochable[]
  /** Combien de titres restent à valider. Zéro = cette personne est entièrement validée. */
  aValider: number
}

/** Le nom, normalisé pour comparer. Vide si on n'en a aucun. */
function cleDuNom(titre: { prenom?: string | null; nom?: string | null }): string {
  return [normaliserTexte(titre.prenom), normaliserTexte(titre.nom)]
    .filter(Boolean)
    .join(' ')
    .trim()
}

/**
 * Un compte connu, pour résoudre le courriel d'un billet.
 *
 * Le point d'API les fournit ; cette fonction ne lit aucune base, afin de rester éprouvable.
 */
export interface CompteConnu {
  userId: number
  prenom?: string | null
  nom?: string | null
}

/**
 * Le compte auquel un billet appartient, s'il est raisonnable de l'affirmer.
 *
 * ⚠️ C'EST L'ÉTAPE QUI FAIT TOUT LE TRAVAIL DEMANDÉ : sans elle, un billet acheté en ligne et une
 * candidature de bénévole restent deux personnes distinctes à l'écran — on cherche la personne
 * deux fois, exactement ce qu'on veut supprimer. Un billet n'a pas de compte en base : il porte un
 * nom et un courriel RECOPIÉS sur la ligne de commande.
 *
 * ⚠️ ET LE NOM DOIT CORRESPONDRE, sans quoi la résolution serait pire que l'absence de
 * regroupement. Mesuré : 163 courriels sur 609 portent des billets à plusieurs noms, l'un d'eux en
 * porte 63 — une association qui achète pour son groupe. Résoudre sur le seul courriel aurait
 * rattaché ces 63 billets au compte du payeur, et un seul clic aurait validé l'entrée de 62
 * absents.
 */
export function compteDuBillet(
  titre: TitreRapprochable,
  comptesParBoite: ReadonlyMap<string, CompteConnu[]>
): number | null {
  if (typeof titre.userId === 'number') return titre.userId

  const boite = cleDeBoiteDeReception(titre.email)
  const nom = cleDuNom(titre)
  if (!boite || !nom) return null

  const candidats = comptesParBoite.get(boite) ?? []
  /*
   * On exige UN SEUL candidat dont le nom corresponde. Deux comptes au même nom sur la même boîte
   * est invraisemblable, mais si cela arrive on préfère ne rien affirmer : un rapprochement
   * ambigu, au contrôle d'accès, se paie en entrées validées à tort.
   */
  const correspondants = candidats.filter((compte) => cleDuNom(compte) === nom)
  return correspondants.length === 1 ? correspondants[0]!.userId : null
}

/**
 * La clé de rapprochement d'un titre, et le motif qui l'accompagne.
 *
 * ⚠️ `null` quand on ne peut rien affirmer : un billet sans courriel, ou sans nom. Ces titres
 * restent SEULS — ils ne rejoignent personne et personne ne les rejoint. Les rapprocher sur un nom
 * seul serait trop faible (« trop d'homonymes », dit déjà `doublons-utilisateurs`), et sur un
 * courriel seul c'est 27 % d'erreurs mesurées.
 */
export function cleDuTitre(
  titre: TitreRapprochable,
  comptesParBoite: ReadonlyMap<string, CompteConnu[]> = new Map()
): { cle: string; motif: MotifDeRegroupement } | null {
  if (typeof titre.userId === 'number') {
    return { cle: `compte:${titre.userId}`, motif: 'compte' }
  }

  /*
   * Un billet résolu vers un compte rejoint la clé de ce compte — c'est ainsi qu'il se range avec
   * la candidature de bénévole de la même personne. Le motif reste « courriel-et-nom » : la
   * jonction repose sur ces deux éléments, pas sur une relation en base, et l'écran doit pouvoir
   * le dire.
   */
  const resolu = compteDuBillet(titre, comptesParBoite)
  if (resolu !== null) return { cle: `compte:${resolu}`, motif: 'courriel-et-nom' }

  const boite = cleDeBoiteDeReception(titre.email)
  const nom = cleDuNom(titre)
  if (!boite || !nom) return null

  return { cle: `courriel:${boite}|nom:${nom}`, motif: 'courriel-et-nom' }
}

/**
 * Les titres de cette personne qui restent à valider.
 *
 * ⚠️ CE SONT EUX, ET EUX SEULS, que le geste groupé doit montrer. Le bouton annonce « Valider les
 * 2 titres restants » : ouvrir une fiche où figure aussi le billet déjà validé la veille fait
 * douter de ce qu'on s'apprête à valider, et oblige à relire trois blocs pour en retrouver deux.
 *
 * 📍 J'avais d'abord gardé les titres validés, grisés, au motif que les faire disparaître
 * laisserait croire qu'on les a oubliés. C'était vrai de la liste à cocher que ce geste remplaçait
 * — on y choisissait titre par titre. Ce n'est plus vrai d'une fiche ouverte depuis un bouton qui
 * a DÉJÀ compté ce qui reste : les titres validés, eux, restent visibles dans les quatre listes de
 * la recherche, juste en dessous.
 */
export function titresAValider(personne: PersonneRapprochee): TitreRapprochable[] {
  return personne.titres.filter((titre) => !titre.entryValidated)
}

/**
 * Cette personne mérite-t-elle qu'on lui propose un geste groupé ?
 *
 * ⚠️ IL FAUT AU MOINS DEUX TITRES **À VALIDER**, et non deux titres tout court. Quelqu'un dont le
 * billet est déjà validé et à qui il ne reste que sa place d'organisateur n'a rien à grouper : le
 * geste porterait sur un seul titre, que la liste juste en dessous propose déjà. L'encart
 * n'ajouterait qu'une seconde façon de faire la même chose — et il afficherait un avertissement
 * sur le rapprochement par courriel, qui n'a plus d'objet quand on ne valide qu'un titre.
 *
 * 📍 La distinction est muette : avec `> 0`, l'encart reste là après la première validation,
 * proposant « Valider le titre restant » à côté du titre lui-même. Rien n'est faux, tout est
 * redondant, et c'est l'utilisateur qui finit par le signaler.
 */
export function meriteUnGesteGroupe(personne: PersonneRapprochee): boolean {
  return personne.titres.length > 1 && personne.aValider > 1
}

/**
 * Regroupe des titres en personnes.
 *
 * Les titres qu'on ne peut pas rapprocher — sans clé — forment chacun leur propre personne : ils
 * restent donc visibles et validables, simplement pas groupés. **Rien ne disparaît.**
 *
 * 📍 Un groupe d'UN SEUL titre est rendu comme les autres : l'écran n'a pas à traiter deux cas, et
 * une personne qui n'a qu'un billet se valide par le même geste que celle qui en a quatre.
 */
export function regrouperParPersonne(
  titres: TitreRapprochable[],
  comptesParBoite: ReadonlyMap<string, CompteConnu[]> = new Map()
): PersonneRapprochee[] {
  const groupes = new Map<string, PersonneRapprochee>()
  let isoles = 0

  for (const titre of titres) {
    const identite = cleDuTitre(titre, comptesParBoite)
    // Sans clé, une clé unique par titre : il reste seul, et deux titres sans clé ne se
    // rapprochent jamais l'un de l'autre par accident.
    const cle = identite?.cle ?? `isole:${isoles++}`
    const motif = identite?.motif ?? 'courriel-et-nom'

    let groupe = groupes.get(cle)
    if (!groupe) {
      groupe = { cle, motif: 'compte', libelle: '', titres: [], aValider: 0 }
      groupes.set(cle, groupe)
    }

    /*
     * ⚠️ LE MOTIF LE PLUS FAIBLE L'EMPORTE, et j'avais d'abord écrit l'inverse.
     *
     * Un groupe vaut la confiance de son maillon le plus faible. Réunir une candidature de
     * bénévole — certaine, même compte — et un billet rapproché par courriel et nom donne un
     * groupe INCERTAIN : c'est l'appartenance du billet qui est en jeu, pas celle du bénévole.
     * L'annoncer « compte » aurait fait traiter le groupe comme sûr, sans rien demander — alors
     * que c'est précisément là qu'il faut un regard humain.
     *
     * 📍 Mon raisonnement initial — « annoncer le plus faible ferait confirmer ce qui est
     * certain » — confondait la meilleure preuve du groupe avec sa garantie. Un test l'a dit.
     */
    if (motif === 'courriel-et-nom') groupe.motif = 'courriel-et-nom'

    groupe.titres.push(titre)
    if (!titre.entryValidated) groupe.aValider += 1

    const nomLisible = [titre.prenom, titre.nom].filter(Boolean).join(' ').trim()
    if (!groupe.libelle && nomLisible) groupe.libelle = nomLisible
  }

  /*
   * Les personnes qui ont le PLUS à valider d'abord : c'est l'ordre dans lequel on les traite au
   * guichet. À égalité, l'ordre d'arrivée est conservé — `sort` est stable —, donc l'ordre de la
   * recherche, qui est déjà pertinent.
   */
  return [...groupes.values()].sort((a, b) => b.aValider - a.aValider)
}
