import { lstat, readdir, rmdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Ménage du dossier des envois temporaires.
 *
 * Les formulaires déposent leurs images dans `<mount>/temp/**` avant que l'entité soit
 * enregistrée : affiche d'une édition, image de spectacle, photo de profil, justificatif de
 * trésorerie. Le fichier n'est déplacé vers son dossier définitif qu'à l'enregistrement. Une
 * saisie abandonnée laisse donc son image derrière elle, et **rien ne l'a jamais supprimée** —
 * le dossier grossissait depuis toujours.
 *
 * Le délai de grâce protège le cas inverse : un fichier tout juste envoyé appartient à un
 * formulaire encore ouvert, et le supprimer ferait disparaître la photo sous les doigts de la
 * personne en train de saisir.
 */
export const AGE_DE_GRACE_MS = 60 * 60 * 1000

export interface ResultatNettoyage {
  fichiersSupprimes: number
  dossiersSupprimes: number
  octetsLiberes: number
}

/**
 * Supprime les fichiers de `racine` plus vieux que `ageMaxMs`, puis les dossiers devenus vides.
 *
 * Ne suit jamais un lien symbolique : `lstat` décrit le lien lui-même, si bien qu'un lien planté
 * dans `temp/` ne peut pas servir de passerelle vers le reste du disque. Un lien périmé est
 * supprimé comme un fichier ordinaire — c'est le lien qui part, pas sa cible.
 *
 * La racine elle-même n'est jamais supprimée : les points d'envoi la recréeraient, mais un
 * dossier qui disparaît sous un envoi en cours produirait une erreur inutile.
 */
export async function nettoyerEnvoisTemporaires(
  racine: string,
  maintenant: number = Date.now(),
  ageMaxMs: number = AGE_DE_GRACE_MS
): Promise<ResultatNettoyage> {
  const resultat: ResultatNettoyage = {
    fichiersSupprimes: 0,
    dossiersSupprimes: 0,
    octetsLiberes: 0,
  }

  await parcourir(racine, true)
  return resultat

  async function parcourir(dossier: string, estRacine: boolean): Promise<void> {
    let entrees
    try {
      entrees = await readdir(dossier, { withFileTypes: true })
    } catch {
      // Dossier absent — cas normal sur une installation neuve.
      return
    }

    for (const entree of entrees) {
      const chemin = join(dossier, entree.name)

      if (entree.isDirectory()) {
        await parcourir(chemin, false)
        continue
      }

      try {
        // `stat` sur un lien décrirait sa CIBLE, dont l'âge n'a rien à voir.
        const infos = await lstat(chemin)
        if (maintenant - infos.mtimeMs < ageMaxMs) continue

        await unlink(chemin)
        resultat.fichiersSupprimes++
        resultat.octetsLiberes += infos.size
      } catch {
        // Fichier déjà parti, ou droits insuffisants : on continue le ménage.
      }
    }

    if (estRacine) return

    // `rmdir` échoue si le dossier n'est pas vide : c'est exactement le garde-fou voulu, aucun
    // dossier encore peuplé ne peut disparaître ici.
    try {
      await rmdir(dossier)
      resultat.dossiersSupprimes++
    } catch {
      /* pas vide, ou déjà supprimé */
    }
  }
}

/** Racine des envois temporaires, sous le même montage que le reste des fichiers. */
export function racineTemporaire(): string {
  return join(process.env.NUXT_FILE_STORAGE_MOUNT || '/uploads', 'temp')
}
