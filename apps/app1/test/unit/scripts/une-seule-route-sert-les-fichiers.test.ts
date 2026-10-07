import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

/**
 * UNE SEULE route sert les fichiers déposés, et elle porte la garde.
 *
 * ## Pourquoi ce test existe
 *
 * Il y en avait DEUX. `server/routes/uploads/**` exige une session et un droit sur l'édition pour
 * un justificatif — facture, billet de train, pièce comptable. `server/api/uploads/**` servait les
 * mêmes chemins sans aucune garde, et était en plus déclaré PUBLIC dans `public-routes.ts`.
 *
 * Elle ne lisait que `public/uploads`, vide dans l'image et où plus rien n'écrit : mesuré en
 * production, elle rendait 404 sur un fichier que l'autre route rendait en 200. La faille était
 * donc latente et non active — mais elle attendait qu'on repeuple ce dossier.
 *
 * ## Ce que ce test attrape, et ce qu'il n'attrape pas
 *
 * Il ne vérifie pas une liste d'exceptions — un tel dispositif exempte en silence ce qu'on y
 * ajoute. Il COMPTE : si un second gestionnaire se met à servir le dépôt de fichiers, le test
 * échoue en le nommant, et il faut alors décider s'il doit être gardé. C'est la décision qui
 * manquait.
 *
 * Il ne dit rien du CONTENU de la garde — que les bons droits soient exigés pour les bons domaines
 * est l'objet de `test/nuxt/server/routes/uploads-justificatifs.test.ts`.
 */
const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const MONOREPO = join(RACINE, '..', '..')

/** Les arborescences où vit du code serveur : l'application, et chaque layer partagé. */
const ARBRES = [
  join(RACINE, 'server/api'),
  join(RACINE, 'server/routes'),
  ...readdirSync(join(MONOREPO, 'layers'))
    .map((layer) => join(MONOREPO, 'layers', layer, 'server'))
    .filter((chemin) => {
      try {
        return statSync(chemin).isDirectory()
      } catch {
        return false
      }
    }),
]

function fichiersTs(racine: string): string[] {
  try {
    if (!statSync(racine).isDirectory()) return []
  } catch {
    return []
  }
  return readdirSync(racine, { withFileTypes: true }).flatMap((entree) => {
    const chemin = join(racine, entree.name)
    if (entree.isDirectory()) return fichiersTs(chemin)
    return entree.name.endsWith('.ts') ? [chemin] : []
  })
}

/**
 * Un gestionnaire SERT le dépôt de fichiers quand il en désigne la racine **et** renvoie le
 * contenu d'un fichier. Les deux conditions comptent : la racine seule désigne aussi les utils qui
 * déplacent ou suppriment des pièces, qui n'exposent rien.
 */
const DESIGNE_LE_DEPOT = /NUXT_FILE_STORAGE_MOUNT|['"]public\/uploads['"]|'public',\s*'uploads'/
const REND_UN_FICHIER = /sendStream\s*\(|createReadStream\s*\(|readFile\s*\(/

describe('les fichiers déposés ne sont servis que par une route, et elle est gardée', () => {
  const servent = ARBRES.flatMap(fichiersTs)
    .filter((chemin) => {
      const source = readFileSync(chemin, 'utf8')
      return DESIGNE_LE_DEPOT.test(source) && REND_UN_FICHIER.test(source)
    })
    .map((chemin) => relative(MONOREPO, chemin))
    .sort()

  it('il n’y en a qu’une, et c’est celle qu’on connaît', () => {
    expect(servent).toEqual(['apps/app1/server/routes/uploads/[...path].get.ts'])
  })

  it('et elle exige une session pour un justificatif', () => {
    const source = readFileSync(join(RACINE, 'server/routes/uploads/[...path].get.ts'), 'utf8')

    // La garde, et les deux domaines qu'elle couvre. Retirer l'un d'eux rendrait ses pièces
    // publiques à qui connaît l'URL — c'est arrivé pour `artists`.
    expect(source).toContain('getAuthSession')
    expect(source).toContain("'treasury'")
    expect(source).toContain("'artists'")
  })
})
