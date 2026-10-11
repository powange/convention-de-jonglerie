import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, it, expect } from 'vitest'

const RACINE = process.cwd()
const DEPOT = join(RACINE, '..', '..')
const DOCKERFILE = join(RACINE, 'Dockerfile')
const ENTRYPOINT = join(RACINE, 'docker', 'entrypoint.sh')
const GITIGNORE = join(DEPOT, '.gitignore')

/**
 * L'image de production embarquait tout l'outillage de développement — constat A8.
 *
 * ## Le défaut
 *
 * `COPY --from=builder /app/apps/app1/scripts ./scripts` copiait **46 fichiers** dans l'image
 * runtime : outils de seed, de test, de debug, de migration ponctuelle. Parmi eux
 * `_temp-password-swap.ts`, qui remplace le hash bcrypt d'un utilisateur par un mot de passe
 * temporaire et garde l'original dans `.pwd-swap-backup.json`.
 *
 * ## ⚠️ LA FICHE EXAGÈRE SUR UN POINT, ET IL FAUT LE DIRE
 *
 * Elle écrit que « le script est exécutable tel quel dans le conteneur de prod ». Mesuré, il porte
 * **deux gardes** : refus si `NODE_ENV === 'production'` ou `NUXT_ENV` ∈ {staging, release}, et
 * refus si l'hôte de la base n'est pas local. Or `docker-compose.release.yml` **et**
 * `docker-compose.prod.yml` posent tous deux `NODE_ENV: 'production'`, comme le Dockerfile — le
 * script **refusait** donc de s'exécuter.
 *
 * Ce qui reste vrai, et justifie le lot : `tsx` est en dépendance de **production**, l'override
 * `ALLOW_PASSWORD_SWAP=I_KNOW` suffit à lever les deux gardes pour qui a un shell dans le
 * conteneur, et un outil de ce genre n'a simplement rien à faire dans une image de production.
 * **On ne compte pas sur une garde interne pour ce qu'on peut ne pas livrer.**
 *
 * ## 🔬 Vérifié avant de retirer le dossier
 *
 * Rien en production ne s'en sert : `entrypoint.sh` fabrique son URL de base en `node -e` inline
 * puis fait `exec node .output/server/index.mjs`, et les trois seuls endroits du serveur qui
 * lancent un processus externe appellent `mysqldump`, `mysql`, `tar` et
 * `npx prisma migrate deploy` — jamais un fichier de ce dossier.
 *
 * Le stage de **build** en garde besoin (le `postinstall` relie les layers) : seule la copie vers
 * le stage runtime disparaît.
 */
describe('image de production sans outillage de développement', () => {
  it('⚠️ `scripts/` N’EST PAS COPIÉ DANS L’IMAGE RUNTIME', async () => {
    const dockerfile = await readFile(DOCKERFILE, 'utf8')

    /*
     * On cherche la copie vers le stage runtime, pas toute mention de `scripts` : le stage de build
     * en copie légitimement un fichier (`lier-layers-node-modules.mjs`, exigé par le
     * `postinstall`), et l'interdire ferait échouer l'installation.
     */
    const copiesLarges = [...dockerfile.matchAll(/^COPY --from=builder .*\/scripts\s/gm)].map((m) =>
      m[0].trim()
    )

    expect(
      copiesLarges,
      `L'image runtime embarquerait les 46 fichiers d'outillage, dont un outil d'échange de mot de ` +
        `passe. Si un script devient nécessaire en production, le copier NOMMÉMENT :\n${copiesLarges.join('\n')}`
    ).toEqual([])
  })

  it('⚠️ L’ENTRYPOINT N’APPELLE AUCUN SCRIPT DU DOSSIER', async () => {
    /*
     * LE TÉMOIN du cas précédent : si l'entrypoint venait à dépendre d'un script, retirer le
     * dossier casserait le démarrage en production — et on l'apprendrait au déploiement, pas en CI.
     * Ce cas tombe alors, et dit quoi faire : copier ce fichier nommément.
     */
    const entrypoint = await readFile(ENTRYPOINT, 'utf8')
    const appels = [...entrypoint.matchAll(/scripts\/[\w.-]+/g)].map((m) => m[0])

    expect(
      appels,
      `L'entrypoint appelle des scripts que l'image ne contient plus : les copier nommément dans ` +
        `le Dockerfile.\n${appels.join('\n')}`
    ).toEqual([])

    // Et il fait bien ce qu'on croit : démarrer le serveur construit.
    expect(entrypoint).toContain('.output/server/index.mjs')
  })

  it('⚠️ LA SAUVEGARDE DE HASH EST IGNORÉE PAR GIT', async () => {
    /*
     * `.pwd-swap-backup.json` contient le hash bcrypt d'un vrai compte, le temps d'un échange de
     * mot de passe en développement. Il n'était PAS dans `.gitignore` : un `git add -A` l'aurait
     * commité, et le hash serait entré dans l'historique du dépôt — d'où il ne sort plus.
     */
    const gitignore = await readFile(GITIGNORE, 'utf8')
    expect(gitignore).toContain('.pwd-swap-backup.json')
  })
})
