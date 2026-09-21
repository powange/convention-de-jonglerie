/**
 * Faire télécharger un fichier construit dans le navigateur.
 *
 * Le geste — créer un objet URL, fabriquer un lien, le cliquer, le retirer, libérer l'URL — est
 * recopié à six endroits du dépôt, chaque fois un peu différemment : certains oublient le
 * `revokeObjectURL` et laissent fuir la mémoire, d'autres n'enlèvent pas le lien du document.
 *
 * Écrit ici une fois. Les six copies existantes n'ont pas été migrées avec ce lot — elles
 * fonctionnent, et les toucher aurait mêlé un nettoyage à une livraison.
 */
export function telechargerFichier(nomDeFichier: string, contenu: BlobPart, type: string): void {
  // Sans `document`, il n'y a rien à télécharger : le rendu serveur n'a pas de dossier de
  // téléchargements. Un garde plutôt qu'une exception, pour que l'appelant n'ait pas à y penser.
  if (typeof document === 'undefined') return

  const url = URL.createObjectURL(new Blob([contenu], { type }))
  const lien = document.createElement('a')
  lien.href = url
  lien.download = nomDeFichier
  document.body.appendChild(lien)
  lien.click()
  document.body.removeChild(lien)
  // Libérée tout de suite : le téléchargement est déjà lancé, et une URL d'objet retient son
  // contenu en mémoire tant qu'on ne la révoque pas.
  URL.revokeObjectURL(url)
}
