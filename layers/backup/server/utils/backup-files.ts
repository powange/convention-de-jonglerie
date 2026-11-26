import { readdir, stat } from 'fs/promises'
import path from 'path'

/** Dossier des sauvegardes, partagé par create / list / restore / upload / search. */
export const backupsDir = () => path.join(process.cwd(), 'backups')

/** Extensions acceptées, à la fois pour l'import et pour la restauration. */
export const isSupportedBackupName = (filename: string) =>
  filename.endsWith('.sql') || filename.endsWith('.tar.gz')

/**
 * Nom sûr pour stocker un fichier reçu du navigateur dans le dossier `backups` :
 * on ne garde que le nom de base (pas de path traversal), on neutralise les caractères
 * exotiques et on préfixe par un horodatage pour ne jamais écraser une sauvegarde existante.
 */
export function buildStoredBackupFilename(originalFilename: string): string {
  const base = path.basename(originalFilename).replace(/[^a-zA-Z0-9._-]/g, '_')
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-')
  return `uploaded-${timestamp}-${base}`
}

export interface BackupFile {
  filename: string
  createdAt: string
  size: number
  type: 'archive' | 'sql'
}

/**
 * Liste les sauvegardes présentes sur le disque, la plus récente en premier.
 * Retourne une liste vide si le dossier n'existe pas encore.
 */
export async function listBackupFiles(): Promise<BackupFile[]> {
  let files: string[]
  try {
    files = await readdir(backupsDir())
  } catch (error: any) {
    if (error?.code === 'ENOENT') return []
    throw error
  }

  const backups: BackupFile[] = []
  for (const file of files) {
    if (!isSupportedBackupName(file)) continue
    const fileStat = await stat(path.join(backupsDir(), file))
    backups.push({
      filename: file,
      createdAt: fileStat.birthtime.toISOString(),
      size: fileStat.size,
      type: file.endsWith('.tar.gz') ? 'archive' : 'sql',
    })
  }

  backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return backups
}
