/**
 * Le titulaire d'un billet est-il l'acheteur de la commande ?
 *
 * Au guichet, la fiche d'une commande montre l'acheteur, puis chaque billet avec son titulaire.
 * Dans la grande majorité des cas ce sont les mêmes : quelqu'un achète pour lui-même, et son nom
 * et son adresse sont recopiés à l'identique sur la ligne. La fiche répète alors deux fois la même
 * chose, et c'est précisément ce qui fait manquer le cas qui compte — un billet acheté POUR
 * QUELQU'UN D'AUTRE, qui ne se repère qu'en relisant quatre champs.
 */

/** Ce qu'il faut savoir d'une ligne de commande pour la comparer. */
export interface TitulaireDeBillet {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
}

/** Ce qu'il faut savoir de l'acheteur. */
export interface AcheteurDeCommande {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
}

/** Pour comparer : sans casse, sans espaces en trop. */
function normaliser(valeur?: string | null): string {
  return (valeur ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Le titulaire et l'acheteur sont-ils la même personne, de façon à ne rien perdre en l'abrégeant ?
 *
 * ⚠️ IL FAUT QUE TOUT CORRESPONDE, nom ET adresse. Un billet au nom de l'acheteur mais à une autre
 * adresse — ou l'inverse — porte un renseignement qu'on ne doit pas effacer : c'est justement là
 * qu'un billet change de main. Un rapprochement partiel reste donc affiché en entier.
 *
 * ⚠️ ET RIEN N'EST « IDENTIQUE » QUAND IL N'Y A RIEN. Deux adresses vides se ressemblent sans dire
 * qu'il s'agit de la même personne ; abréger reviendrait à affirmer ce qu'on ignore, et à masquer
 * une ligne incomplète. Une comparaison exige au moins un nom et une adresse de chaque côté.
 *
 * 📍 La comparaison des adresses est LITTÉRALE, à la casse et aux espaces près. On n'emploie pas
 * ici la clé de boîte de réception qui sert à rapprocher les personnes : elle traite `jean+asso@`
 * et `jean@` comme une seule adresse, ce qui est utile pour deviner un rapprochement, mais pas
 * pour décider de CACHER une valeur que l'opérateur est venu lire.
 */
export function estIdentiqueALAcheteur(
  titulaire: TitulaireDeBillet,
  acheteur?: AcheteurDeCommande | null
): boolean {
  if (!acheteur) return false

  const adresse = normaliser(titulaire.email)
  const adresseAcheteur = normaliser(acheteur.email)
  if (!adresse || !adresseAcheteur) return false

  const nom = `${normaliser(titulaire.firstName)} ${normaliser(titulaire.lastName)}`.trim()
  const nomAcheteur = `${normaliser(acheteur.firstName)} ${normaliser(acheteur.lastName)}`.trim()
  if (!nom || !nomAcheteur) return false

  return adresse === adresseAcheteur && nom === nomAcheteur
}
