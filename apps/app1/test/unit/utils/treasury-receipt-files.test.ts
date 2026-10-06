import { beforeEach, describe, expect, it, vi } from 'vitest'

const unlinkMock = vi.hoisted(() => vi.fn())
const renameMock = vi.hoisted(() => vi.fn())
const mkdirMock = vi.hoisted(() => vi.fn())
// Sans le préfixe `node:` : c'est sous cet identifiant que Vite résout le module ici, comme le
// font déjà les autres tests du dépôt qui mockent le système de fichiers.
// Les deux identifiants : selon la résolution de Vite, le module est vu sous l'un ou l'autre.
vi.mock('fs/promises', () => {
  const mod = { unlink: unlinkMock, rename: renameMock, mkdir: mkdirMock }
  return { ...mod, default: { ...mod } }
})
vi.mock('node:fs/promises', () => {
  const mod = { unlink: unlinkMock, rename: renameMock, mkdir: mkdirMock }
  return { ...mod, default: { ...mod } }
})

import {
  deplacerJustificatif,
  supprimerJustificatif,
} from '../../../server/utils/treasury-receipt-files'

/**
 * Suppression physique du justificatif d'une entrée de trésorerie.
 *
 * Demandé explicitement : une photo retirée doit disparaître du disque, pas seulement de la base.
 *
 * Ce que ces tests protègent avant tout, c'est la traversée de répertoire. `imageUrl` est une
 * colonne que le client écrit : un `PUT` peut y placer n'importe quoi, et on s'apprête à passer
 * cette valeur à `unlink`. Le nom de fichier est donc dépouillé de tout dossier et recollé au
 * dossier de l'édition, reconstruit côté serveur.
 */
const EDITION = { id: 21, conventionId: 4 }
const DOSSIER = '/uploads/conventions/4/editions/21/treasury'

describe('supprimerJustificatif', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    unlinkMock.mockResolvedValue(undefined)
  })

  it('supprime le fichier dans le dossier de trésorerie de l’édition', async () => {
    await supprimerJustificatif(`${DOSSIER}/ticket-a1b2c3d4.jpg`, EDITION)

    expect(unlinkMock).toHaveBeenCalledWith(`${DOSSIER}/ticket-a1b2c3d4.jpg`)
  })

  it('ne sort jamais du dossier, quel que soit le chemin reçu', async () => {
    // Ces valeurs ne peuvent pas venir de notre endpoint d'envoi — elles viennent d'un client.
    for (const hostile of [
      '../../../../etc/passwd',
      '/etc/passwd',
      '/uploads/conventions/999/editions/999/treasury/vole.jpg',
      'C:\\Windows\\System32\\drivers\\etc\\hosts',
    ]) {
      unlinkMock.mockClear()
      await supprimerJustificatif(hostile, EDITION)

      const chemin = unlinkMock.mock.calls[0]?.[0] as string | undefined
      expect(chemin, `chemin refusé ou contenu pour « ${hostile} »`).toBeDefined()
      expect(chemin!.startsWith(`${DOSSIER}/`), `« ${hostile} » sort du dossier : ${chemin}`).toBe(
        true
      )
      expect(chemin).not.toContain('..')
    }
  })

  it('ne fait rien sans justificatif', async () => {
    await supprimerJustificatif(null, EDITION)
    await supprimerJustificatif(undefined, EDITION)
    await supprimerJustificatif('', EDITION)
    expect(unlinkMock).not.toHaveBeenCalled()
  })

  it('ignore un fichier déjà absent', async () => {
    const absent = Object.assign(new Error('nope'), { code: 'ENOENT' })
    unlinkMock.mockRejectedValue(absent)

    // Ne doit pas rejeter : sinon une entrée deviendrait impossible à corriger parce qu'un
    // fichier a disparu du disque.
    await expect(supprimerJustificatif(`${DOSSIER}/parti.jpg`, EDITION)).resolves.toBeUndefined()
  })
})

describe('deplacerJustificatif', () => {
  const TEMP = '/uploads/temp/treasury/21'

  beforeEach(() => {
    vi.clearAllMocks()
    mkdirMock.mockResolvedValue(undefined)
    renameMock.mockResolvedValue(undefined)
  })

  it('déplace le fichier temporaire vers le dossier de l’édition', async () => {
    const url = await deplacerJustificatif(`${TEMP}/ticket-a1b2c3d4.jpg`, EDITION)

    expect(renameMock).toHaveBeenCalledWith(
      `${TEMP}/ticket-a1b2c3d4.jpg`,
      `${DOSSIER}/ticket-a1b2c3d4.jpg`
    )
    expect(url).toBe(`${DOSSIER}/ticket-a1b2c3d4.jpg`)
  })

  it('laisse intacte une URL déjà définitive', async () => {
    // Réenregistrer une entrée sans toucher à sa photo ne doit pas la déplacer une seconde fois.
    const deja = `${DOSSIER}/ticket-a1b2c3d4.jpg`
    expect(await deplacerJustificatif(deja, EDITION)).toBe(deja)
    expect(renameMock).not.toHaveBeenCalled()
  })

  it('ne sort jamais du dossier, quel que soit le chemin reçu', async () => {
    // `/temp/` dans le chemin suffit à déclencher le déplacement : la valeur vient du client.
    await deplacerJustificatif('/uploads/temp/../../../../etc/passwd', EDITION)

    const [source, cible] = renameMock.mock.calls[0] ?? []
    expect(String(source).startsWith(`${TEMP}/`), `source hors du temporaire : ${source}`).toBe(
      true
    )
    expect(String(cible).startsWith(`${DOSSIER}/`), `cible hors du dossier : ${cible}`).toBe(true)
  })

  it("rend null si le fichier temporaire a disparu, plutôt que d'empêcher l'enregistrement", async () => {
    renameMock.mockRejectedValue(Object.assign(new Error('nope'), { code: 'ENOENT' }))

    expect(await deplacerJustificatif(`${TEMP}/parti.jpg`, EDITION)).toBeNull()
  })

  it('ne fait rien sans justificatif', async () => {
    expect(await deplacerJustificatif(null, EDITION)).toBeNull()
    expect(renameMock).not.toHaveBeenCalled()
  })

  /*
   * « Inchangée » ne veut pas dire « sans regarder ».
   *
   * Toute URL sans `/temp/` était rendue telle quelle : un client pouvait donc enregistrer le
   * justificatif d'une AUTRE édition, ou une adresse externe, que la page de gestion affichait
   * ensuite dans un `<img>` — c'est-à-dire une requête sortante déclenchée par l'ouverture d'un
   * écran de trésorerie.
   */
  it('refuse le justificatif d’une autre édition', async () => {
    await expect(
      deplacerJustificatif('/uploads/conventions/9/editions/99/treasury/ticket.jpg', EDITION)
    ).rejects.toThrow('Justificatif invalide')
  })

  it('refuse une adresse externe', async () => {
    await expect(deplacerJustificatif('https://exemple.test/pixel.gif', EDITION)).rejects.toThrow(
      'Justificatif invalide'
    )
  })

  it('refuse un chemin qui remonte hors du dossier de trésorerie', async () => {
    // Le nom de fichier ne peut porter aucune barre oblique, sans quoi celui-ci retomberait dans le
    // motif tout en désignant autre chose.
    await expect(deplacerJustificatif(`${DOSSIER}/../../../secret.jpg`, EDITION)).rejects.toThrow(
      'Justificatif invalide'
    )
  })

  it('refuse un autre dossier de la même édition', async () => {
    await expect(
      deplacerJustificatif('/uploads/conventions/7/editions/21/posters/affiche.jpg', EDITION)
    ).rejects.toThrow('Justificatif invalide')
  })

  it('accepte un justificatif PDF du bon dossier', async () => {
    // Beaucoup de factures n'existent qu'en PDF : le motif ne doit pas se limiter aux images.
    const pdf = `${DOSSIER}/facture-a1b2c3d4.pdf`
    expect(await deplacerJustificatif(pdf, EDITION)).toBe(pdf)
  })
})

/**
 * Le même dispositif, pour les justificatifs d'un ARTISTE.
 *
 * ⚠️ POURQUOI UN PARAMÈTRE ET NON UNE SECONDE COPIE DU FICHIER. Un billet de train obéit aux mêmes
 * règles qu'une pièce comptable : dépôt temporaire, déplacement à l'enregistrement, nom dépouillé
 * de tout chemin. Seul le sous-dossier change. Recopier le fichier aurait fait diverger deux gardes
 * de SÉCURITÉ — et un écart de ce genre ne se voit qu'en étant attaqué.
 *
 * Ces tests valent donc autant pour ce qu'ils vérifient que pour ce qu'ils interdisent : que le
 * domaine ne serve pas de porte dérobée vers le dossier d'un autre.
 */
describe('les justificatifs d’un artiste', () => {
  const DOSSIER_ARTISTES = '/uploads/conventions/4/editions/21/artists'

  beforeEach(() => {
    vi.clearAllMocks()
    renameMock.mockResolvedValue(undefined)
    mkdirMock.mockResolvedValue(undefined)
    unlinkMock.mockResolvedValue(undefined)
  })

  it('déplace depuis le dossier temporaire du BON domaine', async () => {
    const url = await deplacerJustificatif(
      '/uploads/temp/artists/21/billet-a1b2c3d4.jpg',
      EDITION,
      'artists'
    )

    expect(url).toBe(`${DOSSIER_ARTISTES}/billet-a1b2c3d4.jpg`)
    expect(renameMock).toHaveBeenCalledWith(
      '/uploads/temp/artists/21/billet-a1b2c3d4.jpg',
      `${DOSSIER_ARTISTES}/billet-a1b2c3d4.jpg`
    )
  })

  it('⚠️ REFUSE un justificatif qui désigne le dossier d’un AUTRE domaine', async () => {
    /*
     * Le cœur de la garde : sans elle, un client pourrait enregistrer sur un artiste l'URL d'une
     * pièce comptable de la même édition — et la page de gestion des artistes l'afficherait à des
     * gens qui n'ont pas le droit de voir la trésorerie.
     */
    await expect(
      deplacerJustificatif(`${DOSSIER}/ticket-a1b2c3d4.jpg`, EDITION, 'artists')
    ).rejects.toThrow(/Justificatif invalide/)
  })

  it('…et le domaine « treasury » refuse symétriquement celui des artistes', async () => {
    // Le témoin de la précédente : la garde doit mordre dans les deux sens, pas seulement dans
    // celui qu'on vient d'ajouter.
    await expect(
      deplacerJustificatif(`${DOSSIER_ARTISTES}/billet-a1b2c3d4.jpg`, EDITION)
    ).rejects.toThrow(/Justificatif invalide/)
  })

  it('⚠️ la traversée de répertoire reste impossible', async () => {
    // `imageUrl` est une colonne que le client écrit. Le nom est dépouillé de tout dossier et
    // recollé à celui de l'édition, reconstruit ici : `../../../etc/passwd` se réduit à `passwd`.
    await deplacerJustificatif('/uploads/temp/../../../../etc/passwd', EDITION, 'artists')

    expect(renameMock).toHaveBeenCalledWith(
      '/uploads/temp/artists/21/passwd',
      `${DOSSIER_ARTISTES}/passwd`
    )
  })

  it('supprime dans le dossier du domaine, et nulle part ailleurs', async () => {
    await supprimerJustificatif(`${DOSSIER_ARTISTES}/billet-a1b2c3d4.jpg`, EDITION, 'artists')

    expect(unlinkMock).toHaveBeenCalledWith(`${DOSSIER_ARTISTES}/billet-a1b2c3d4.jpg`)
  })
})
