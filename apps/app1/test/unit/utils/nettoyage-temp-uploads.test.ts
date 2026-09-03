import { mkdtemp, mkdir, readdir, stat, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  AGE_DE_GRACE_MS,
  nettoyerEnvoisTemporaires,
} from '../../../server/utils/nettoyage-temp-uploads'

/**
 * Purge des envois temporaires abandonnés.
 *
 * Les formulaires déposent leur image dans `temp/` avant enregistrement ; une saisie abandonnée
 * la laissait là définitivement, aucune tâche ne nettoyant ce dossier.
 *
 * Ces tests travaillent sur un VRAI dossier temporaire plutôt que sur un système de fichiers
 * simulé : ce qu'il faut prouver, c'est qu'on supprime les bons fichiers et qu'on épargne les
 * autres — une assertion sur des appels mockés ne dirait rien de ce qui reste sur le disque.
 */
describe('nettoyerEnvoisTemporaires', () => {
  let racine: string

  const vieillir = async (chemin: string, ageMs: number) => {
    const quand = new Date(Date.now() - ageMs)
    await utimes(chemin, quand, quand)
  }

  const creerFichier = async (chemin: string, ageMs = 0) => {
    await mkdir(join(chemin, '..'), { recursive: true }).catch(() => {})
    await writeFile(chemin, 'x'.repeat(100))
    if (ageMs) await vieillir(chemin, ageMs)
  }

  const existe = async (chemin: string) =>
    stat(chemin).then(
      () => true,
      () => false
    )

  beforeEach(async () => {
    racine = await mkdtemp(join(tmpdir(), 'temp-uploads-'))
  })

  afterEach(async () => {
    await import('node:fs/promises').then((fs) =>
      fs.rm(racine, { recursive: true, force: true }).catch(() => {})
    )
  })

  it('supprime un fichier abandonné et rend le compte', async () => {
    const vieux = join(racine, 'editions', '12', 'affiche.jpg')
    await mkdir(join(racine, 'editions', '12'), { recursive: true })
    await creerFichier(vieux, 2 * AGE_DE_GRACE_MS)

    const resultat = await nettoyerEnvoisTemporaires(racine)

    expect(await existe(vieux)).toBe(false)
    expect(resultat.fichiersSupprimes).toBe(1)
    expect(resultat.octetsLiberes).toBe(100)
  })

  it('épargne un fichier récent — le formulaire est peut-être encore ouvert', async () => {
    // C'est LE cas qui compte : supprimer ici ferait disparaître la photo sous les doigts de
    // quelqu'un en train de saisir.
    const recent = join(racine, 'treasury', '7', 'ticket.jpg')
    await mkdir(join(racine, 'treasury', '7'), { recursive: true })
    await creerFichier(recent, 30 * 60 * 1000)

    const resultat = await nettoyerEnvoisTemporaires(racine)

    expect(await existe(recent)).toBe(true)
    expect(resultat.fichiersSupprimes).toBe(0)
  })

  it('retire les dossiers devenus vides, mais garde ceux qui servent encore', async () => {
    await mkdir(join(racine, 'vide', '1'), { recursive: true })
    await creerFichier(join(racine, 'vide', '1', 'parti.jpg'), 2 * AGE_DE_GRACE_MS)
    await mkdir(join(racine, 'occupe'), { recursive: true })
    await creerFichier(join(racine, 'occupe', 'reste.jpg'), 0)

    await nettoyerEnvoisTemporaires(racine)

    expect(await existe(join(racine, 'vide', '1'))).toBe(false)
    expect(await existe(join(racine, 'occupe'))).toBe(true)
  })

  it('ne supprime jamais la racine, même entièrement vidée', async () => {
    await creerFichier(join(racine, 'seul.jpg'), 2 * AGE_DE_GRACE_MS)

    await nettoyerEnvoisTemporaires(racine)

    expect(await existe(racine), 'la racine doit survivre : les envois la réutilisent').toBe(true)
    expect(await readdir(racine)).toEqual([])
  })

  it('ne bronche pas sur un dossier inexistant', async () => {
    const resultat = await nettoyerEnvoisTemporaires(join(racine, 'jamais-cree'))

    expect(resultat.fichiersSupprimes).toBe(0)
  })
})
