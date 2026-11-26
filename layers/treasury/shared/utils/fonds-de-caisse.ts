import { cleDuNomAvance } from './avance-nom-libre'

/**
 * L'état du fonds de caisse d'une édition : qui a prêté quoi, ce qui reste à rendre, et ce que
 * la caisse contient à la clôture.
 *
 * ## Pourquoi ce calcul vit à part
 *
 * Un fonds de caisse est un **stock**, pas un flux : l'argent n'est ni consommé ni gagné, il
 * change de poche. Il n'entre donc ni au compte de résultat, ni dans la répartition par
 * imputation — et comme il n'est pas une `TreasuryEntry`, aucun des calculs de trésorerie ne peut
 * l'atteindre. Ce fichier ne connaît rien d'eux, et réciproquement.
 *
 * ## ⚠️ Le piège du comptage de clôture
 *
 * Le réflexe est d'écrire « recettes en espèces = compté − apporté ». **C'est faux dès qu'un prêt
 * a été restitué avant le comptage** : rendre 300 € vide la caisse d'autant, et la soustraction
 * compte ces 300 € comme s'ils y étaient encore.
 *
 * Et même corrigée, la formule ne donnerait pas des « recettes » : il faudrait pour cela connaître
 * les dépenses réglées en espèces, donc le moyen de paiement de chaque ligne de trésorerie — que
 * `TreasuryEntry` ne porte pas.
 *
 * Ce fichier ne prétend donc PAS calculer des recettes. Il rend une quantité, elle, toujours
 * vraie : **ce que la caisse contient au-delà de ce qu'on doit encore aux prêteurs**. Négative,
 * elle dit que la caisse ne couvre plus les prêts — et c'est une alerte, pas une curiosité.
 *
 * ⚠️ Ce fichier n'importe que `./avance-nom-libre` : il est chargé tel quel par les tests
 * unitaires, hors Nuxt.
 */

/** Un apport, tel qu'il est stocké. Les montants sont en centimes entiers, toujours positifs. */
export interface ApportDeFondsDeCaisse {
  id: number
  amount: number
  lentById: number | null
  lentByName: string | null
  /** `null` veut dire « pas restitué » — il n'y a pas de booléen à côté, voir le modèle Prisma. */
  restitutedAt: Date | string | null
}

/** Ce qu'une personne a prêté, et ce qu'on lui doit encore. */
export interface PreteurDeFondsDeCaisse {
  /** Clé stable — `u:<id>` pour un compte, `n:<nom normalisé>` pour un nom libre. */
  cle: string
  lentById: number | null
  nomLibre: string | null
  total: number
  restitue: number
  resteARestituer: number
  /** Les identifiants de ses apports, du plus récent au plus ancien d'insertion. */
  apportIds: number[]
}

export interface EtatDuFondsDeCaisse {
  totalApporte: number
  totalRestitue: number
  resteARestituer: number
  /** Ce qu'on a compté dans la caisse à la clôture, ou `null` si personne ne l'a encore fait. */
  compte: number | null
  /**
   * Ce que la caisse contient au-delà des prêts encore dus : `compte − resteARestituer`.
   * `null` tant que rien n'a été compté. Négatif, la caisse ne couvre plus les prêts.
   */
  disponibleApresRestitutions: number | null
  /** Un prêteur par entrée, du plus gros reste à restituer au plus petit. */
  preteurs: PreteurDeFondsDeCaisse[]
}

const estRestitue = (apport: ApportDeFondsDeCaisse) => apport.restitutedAt != null

/**
 * La clé de regroupement d'un apport.
 *
 * Un compte l'emporte toujours sur un nom : il désigne une personne sans ambiguïté. Un apport sans
 * prêteur identifié tombe dans un groupe anonyme par apport — on ne les fusionne pas, car rien ne
 * dit qu'il s'agit de la même personne.
 */
function cleDuPreteur(apport: ApportDeFondsDeCaisse): string {
  if (apport.lentById) return `u:${apport.lentById}`
  const nom = cleDuNomAvance(apport.lentByName)
  return nom ? `n:${nom}` : `a:${apport.id}`
}

export function etatDuFondsDeCaisse(
  apports: ApportDeFondsDeCaisse[],
  compte: number | null | undefined
): EtatDuFondsDeCaisse {
  const groupes = new Map<string, PreteurDeFondsDeCaisse>()

  for (const apport of apports) {
    const cle = cleDuPreteur(apport)
    const groupe = groupes.get(cle) ?? {
      cle,
      lentById: apport.lentById ?? null,
      // Le nom AFFICHABLE, pas la clé : on regroupe sans la casse mais on montre ce qui a été tapé.
      nomLibre: apport.lentById ? null : (apport.lentByName ?? null),
      total: 0,
      restitue: 0,
      resteARestituer: 0,
      apportIds: [],
    }

    groupe.total += apport.amount
    if (estRestitue(apport)) groupe.restitue += apport.amount
    else groupe.resteARestituer += apport.amount
    groupe.apportIds.push(apport.id)
    groupes.set(cle, groupe)
  }

  const preteurs = [...groupes.values()].sort(
    (a, b) => b.resteARestituer - a.resteARestituer || b.total - a.total
  )

  const totalApporte = preteurs.reduce((somme, p) => somme + p.total, 0)
  const totalRestitue = preteurs.reduce((somme, p) => somme + p.restitue, 0)
  const resteARestituer = totalApporte - totalRestitue

  return {
    totalApporte,
    totalRestitue,
    resteARestituer,
    compte: compte ?? null,
    // Voir la note en tête : SURTOUT PAS `compte − totalApporte`.
    disponibleApresRestitutions: compte == null ? null : compte - resteARestituer,
    preteurs,
  }
}
