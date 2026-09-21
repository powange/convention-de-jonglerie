/**
 * Les filtres de rangement communs aux tableaux du stock : groupe et tags.
 *
 * Ces deux questions se posent partout où le module montre une liste d'objets qui traverse les
 * groupes — les emprunts, ce qui manque, le recomptage. Elles ont d'abord été écrites pour les
 * emprunts, sous des noms qui parlaient d'emprunts ; c'est en devant les reprendre ailleurs que
 * le vrai sujet est apparu : ce ne sont pas des emprunts qu'on filtre, ce sont des objets rangés
 * et tagués.
 *
 * ⚠️ Deux voisins vivent ailleurs, et il ne faut pas les réécrire ici : le filtre par TAGS est
 * dans `filtre-tags-stock`, avec la lecture et l'écriture de l'URL qui l'accompagnent, et la
 * RECHERCHE par nom dans `recherche-materiel`, qui découpe la requête en mots et les cherche dans
 * n'importe quel ordre — « 25 rallonge » trouve « Rallonge 25 m ». Deux fonctions auto-importées
 * sous le même nom ne cohabiteraient pas : Nuxt en choisirait une et ignorerait l'autre, sans
 * rien signaler. C'est arrivé deux fois sur ce module.
 */

/** Un groupe de rangement, réduit à ce dont un filtre a besoin. */
export interface GroupeDObjet {
  id: number
  name: string
}

/** Un tag, réduit à ce dont le filtre et la pastille ont besoin. */
export interface TagDObjet {
  id: number
  name: string
  color: string
}

/** Ce qu'un objet porte pour ces filtres-ci, au-delà de ce que chaque écran lui ajoute. */
export interface ObjetRangeable {
  name?: string
  group?: GroupeDObjet | null
  tags?: Array<{ tag: TagDObjet }> | null
}

/**
 * Les groupes réellement présents dans la liste affichée.
 *
 * Une liste fermée, construite sur ce qui est sous les yeux, plutôt que le catalogue entier de
 * l'édition. Un groupe dont aucun objet n'apparaît n'a rien à proposer — le choisir ne viderait
 * pas seulement le tableau, il ferait douter du filtre.
 *
 * Trié par nom : les identifiants ne disent rien à qui lit, et l'ordre de la base encore moins.
 */
export function groupesDesObjets<T extends ObjetRangeable>(objets: T[]): GroupeDObjet[] {
  const parId = new Map<number, GroupeDObjet>()
  for (const objet of objets) {
    if (objet.group) parId.set(objet.group.id, objet.group)
  }
  return [...parId.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}

/**
 * Les tags réellement posés sur les objets de la liste affichée.
 *
 * Un objet peut en porter plusieurs : chacun entre dans la liste, sans doublon. La couleur voyage
 * avec, parce que le sélecteur montre la pastille — reconnaître un tag à sa couleur est
 * précisément ce pour quoi on l'a posé.
 */
export function tagsDesObjets<T extends ObjetRangeable>(objets: T[]): TagDObjet[] {
  const parId = new Map<number, TagDObjet>()
  for (const objet of objets) {
    for (const lien of objet.tags ?? []) {
      if (lien?.tag) parId.set(lien.tag.id, lien.tag)
    }
  }
  return [...parId.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}

/**
 * Les objets appartenant à l'un des groupes choisis.
 *
 * Aucun groupe choisi, rien n'est filtré — un filtre vide ne doit pas vider l'écran. La
 * comparaison porte sur l'identifiant et non sur le nom : deux groupes peuvent porter le même
 * intitulé, et c'est le genre d'égalité qui se découvre tard.
 *
 * Plusieurs groupes se cumulent en OU : on prépare une tournée qui ramasse la cuisine ET la
 * scène, pas un objet qui serait dans les deux — ce qui n'existe pas.
 */
export function filtrerParGroupes<T extends ObjetRangeable>(
  objets: T[],
  groupeIds: readonly number[] | null | undefined
): T[] {
  if (!groupeIds?.length) return objets
  const retenus = new Set(groupeIds)
  return objets.filter((objet) => (objet.group ? retenus.has(objet.group.id) : false))
}
