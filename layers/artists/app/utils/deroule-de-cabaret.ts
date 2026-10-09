/** Un numéro du déroulé, tel que l'éditeur le manipule. */
export interface NumeroDuDeroule {
  id?: number
  title: string
  companyName: string
  duration: number | string | null
  description: string | null
  technicalNeeds: string | null
  stageSetup: string | null
  artistIds: number[]
}

/**
 * Les numéros dont le titre est vide — ceux qui empêchent l'enregistrement.
 *
 * ## ⚠️ POURQUOI C'EST UN REFUS ET NON UN FILTRE
 *
 * L'enregistrement FILTRAIT silencieusement les numéros sans titre avant d'envoyer le corps. Or le
 * serveur **remplace l'ensemble** du déroulé : les numéros absents du corps étaient donc
 * **supprimés**.
 *
 * Deux conséquences, toutes deux muettes :
 *
 * - un organisateur qui effaçait un titre par mégarde perdait le numéro entier — ses artistes, sa
 *   durée, ses besoins techniques ;
 * - celui qui ajoutait un numéro en renseignant d'abord les artistes et la durée, avant de le
 *   nommer, voyait son travail disparaître à l'enregistrement.
 *
 * Dans les deux cas l'écran annonçait « spectacle mis à jour ». Un filtre silencieux sur une
 * opération de remplacement n'est pas une tolérance : c'est une suppression déguisée.
 */
export function numerosSansTitre(numeros: NumeroDuDeroule[]): number[] {
  return numeros.reduce<number[]>((rangs, numero, rang) => {
    if (!numero.title.trim()) rangs.push(rang)
    return rangs
  }, [])
}

/**
 * L'empreinte d'un déroulé, pour savoir s'il a été modifié depuis son chargement.
 *
 * ## ⚠️ POURQUOI PAS UN `JSON.stringify` DIRECT
 *
 * `JSON.stringify` dépend de l'ORDRE D'INSERTION des clés. Les numéros chargés viennent d'une
 * projection, ceux ajoutés dans l'éditeur sont construits ailleurs : deux objets de même contenu
 * peuvent donc rendre deux chaînes différentes, et la garde de sortie se déclencherait sur un
 * déroulé que personne n'a touché.
 *
 * Les champs sont donc listés **explicitement et dans un ordre fixe**. Le défaut qu'on écarte
 * ainsi n'est pas symétrique : une fausse alerte est agaçante, une fausse absence d'alerte laisse
 * perdre le travail sans rien demander. C'est le second qu'il faut rendre impossible.
 *
 * 📍 `duration` est normalisée, parce que l'éditeur la rend tantôt en nombre, tantôt en chaîne
 * (`UInput` écrit du texte) : sans cela, taper « 12 » puis le retaper à l'identique passerait pour
 * une modification.
 *
 * 📍 `artistIds` est TRIÉ : l'ordre d'un menu de sélection multiple n'a aucun sens métier, et deux
 * sélections des mêmes artistes dans un ordre différent désignent le même numéro.
 */
export function empreinteDuDeroule(numeros: NumeroDuDeroule[]): string {
  return JSON.stringify(
    numeros.map((n) => [
      n.id ?? null,
      n.title.trim(),
      n.companyName.trim(),
      n.duration === null || n.duration === '' ? null : Number(n.duration),
      n.description ?? null,
      n.technicalNeeds ?? null,
      n.stageSetup ?? null,
      [...n.artistIds].sort((a, b) => a - b),
    ])
  )
}
