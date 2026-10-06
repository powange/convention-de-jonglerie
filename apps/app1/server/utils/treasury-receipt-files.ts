import { mkdir, rename, unlink } from 'node:fs/promises'
import { basename, join } from 'node:path'

// Importé explicitement plutôt que pris dans l'auto-import de Nitro : ce fichier est couvert par le
// projet de tests UNITAIRE, qui n'installe aucun global. Sans cet import, la garde échouerait sur
// « createError is not defined » au lieu de rendre son refus.
import { createError } from 'h3'

/** Racine du stockage, la même que celle où écrit `storeFileLocally` et que sert `/uploads/**`. */
const racineStockage = () => process.env.NUXT_FILE_STORAGE_MOUNT || '/uploads'

/**
 * Le DOMAINE d'un justificatif : le sous-dossier où il vit, et le dossier temporaire d'où il vient.
 *
 * ⚠️ UN PARAMÈTRE ET NON UNE SECONDE COPIE DE CE FICHIER. Les justificatifs d'un artiste — billet
 * de train, facture d'essence — obéissent exactement aux mêmes règles que les pièces comptables :
 * dépôt temporaire, déplacement à l'enregistrement, nom de fichier dépouillé de tout chemin. Seul
 * le sous-dossier change. Recopier le fichier aurait fait diverger deux gardes de sécurité, et
 * c'est précisément le genre d'écart qu'on ne voit qu'en étant attaqué.
 */
export type DomaineDeJustificatif = 'treasury' | 'artists'

/** Dossier définitif des justificatifs d'une édition, pour un domaine donné. */
const dossierEdition = (
  edition: { id: number; conventionId: number },
  domaine: DomaineDeJustificatif
) =>
  join(
    racineStockage(),
    'conventions',
    String(edition.conventionId),
    'editions',
    String(edition.id),
    domaine
  )

/**
 * Le nom de fichier, dépouillé de tout dossier — ou `null` s'il ne désigne rien.
 *
 * `imageUrl` est une colonne que le CLIENT écrit : un `PUT` peut y mettre
 * `../../../../etc/passwd`. On ne suit donc jamais le chemin reçu, on n'en garde que le nom, ce
 * qui rend la traversée structurellement impossible au lieu de la filtrer.
 */
function nomDeFichierSeul(chemin: string): string | null {
  const nom = basename(chemin)
  return !nom || nom === '.' || nom === '..' ? null : nom
}

/**
 * Déplace un justificatif du dossier temporaire vers celui de l'édition, et rend son URL finale.
 *
 * Le composant d'envoi dépose d'abord dans `temp/`, comme pour l'affiche d'une édition ou l'image
 * d'un spectacle : tant que l'entrée n'est pas enregistrée, rien ne doit atterrir dans son dossier
 * définitif. Une photo choisie puis abandonnée reste ainsi dans `temp/`, isolée et purgeable en
 * bloc, plutôt que mêlée aux pièces comptables.
 *
 * Rend l'URL inchangée si elle n'est pas temporaire — réenregistrer une entrée sans toucher à sa
 * photo ne doit pas la déplacer une seconde fois. Mais « inchangée » ne veut pas dire
 * « sans regarder » : une URL non temporaire doit désigner le dossier de CETTE édition, et rien
 * d'autre.
 *
 * Ce qui passait auparavant : n'importe quelle chaîne sans `/temp/`. Un client pouvait enregistrer
 * l'URL du justificatif d'une autre édition, ou une adresse externe, que la page affichait ensuite
 * dans un `<img>` — donc une requête sortante déclenchée par l'affichage d'une page de gestion.
 *
 * @throws 400 si l'URL n'est ni temporaire, ni celle du dossier de cette édition
 */
export async function deplacerJustificatif(
  imageUrl: string | null | undefined,
  edition: { id: number; conventionId: number },
  domaine: DomaineDeJustificatif = 'treasury'
): Promise<string | null> {
  if (!imageUrl) return null

  if (!imageUrl.includes('/temp/')) {
    // Forme exacte et rien de plus : le nom de fichier ne peut contenir aucune barre oblique, sans
    // quoi `.../treasury/x/../../autre` retomberait dans le motif.
    const attendu = new RegExp(
      `^/uploads/conventions/${edition.conventionId}/editions/${edition.id}/${domaine}/[^/]+$`
    )
    if (!attendu.test(imageUrl)) {
      throw createError({ status: 400, message: 'Justificatif invalide' })
    }
    return imageUrl
  }

  const nom = nomDeFichierSeul(imageUrl)
  if (!nom) return null

  const source = join(racineStockage(), 'temp', domaine, String(edition.id), nom)
  const dossier = dossierEdition(edition, domaine)

  try {
    await mkdir(dossier, { recursive: true })
    await rename(source, join(dossier, nom))
    return `/uploads/conventions/${edition.conventionId}/editions/${edition.id}/${domaine}/${nom}`
  } catch (error) {
    // Le fichier temporaire a disparu — session trop longue, purge, double enregistrement. Mieux
    // vaut une entrée sans justificatif qu'un refus d'enregistrer une ligne comptable.
    console.warn(`[${domaine}] justificatif temporaire introuvable`, source, error)
    return null
  }
}

/**
 * Suppression physique du justificatif d'une entrée de trésorerie.
 *
 * Un ticket retiré doit disparaître du disque, et pas seulement de la base : l'entrée est
 * supprimée ou son justificatif remplacé, mais le fichier restait, indéfiniment, sans que rien ne
 * le référence.
 *
 * **Le chemin stocké n'est jamais suivi.** Il vient d'une colonne que le client peut écrire — un
 * `PUT` peut y mettre ce qu'il veut. On n'en garde donc que le NOM de fichier, dépouillé de tout
 * dossier par `basename`, et on le recolle au dossier de l'édition, reconstruit ici. Une valeur
 * comme `../../../etc/passwd` se réduit à `passwd` et pointe alors sur un fichier inexistant du
 * dossier de trésorerie : la traversée est structurellement impossible, plutôt que filtrée.
 */
export async function supprimerJustificatif(
  imageUrl: string | null | undefined,
  edition: { id: number; conventionId: number },
  domaine: DomaineDeJustificatif = 'treasury'
): Promise<void> {
  if (!imageUrl) return

  const nomFichier = nomDeFichierSeul(imageUrl)
  if (!nomFichier) return

  const chemin = join(dossierEdition(edition, domaine), nomFichier)

  try {
    await unlink(chemin)
  } catch (error) {
    // Fichier déjà absent, ou droits insuffisants : la trace en base part quand même. Échouer ici
    // empêcherait de corriger une entrée à cause d'un fichier qui n'existe plus.
    const code = (error as NodeJS.ErrnoException)?.code
    if (code !== 'ENOENT') {
      console.warn('[trésorerie] justificatif non supprimé', chemin, code)
    }
  }
}
