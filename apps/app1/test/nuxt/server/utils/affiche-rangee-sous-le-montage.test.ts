import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, it, expect, beforeEach, vi } from 'vitest'

/*
 * ⚠️ DES GLOBALES, ET NON UN `vi.mock('#imports')`.
 *
 * `getFileLocally`, `storeFileLocally` et `deleteFile` viennent de nuxt-file-storage et arrivent
 * dans `file-helpers.ts` par l'auto-import de Nitro, c'est-à-dire comme des globales — le fichier
 * ne les importe pas. Un `vi.mock('#imports')` n'intercepte donc rien : les quatre premiers cas
 * échouaient sur « getFileLocally is not a function », et un mock qui ne s'applique pas ne se
 * signale pas. `test/setup.ts` remplace par ailleurs `#imports` en entier, et un second mock local
 * efface ses stubs — piège déjà payé dans ce dépôt.
 */
const stockage = {
  getFileLocally: vi.fn(),
  storeFileLocally: vi.fn(),
  deleteFile: vi.fn(),
}
vi.stubGlobal('getFileLocally', stockage.getFileLocally)
vi.stubGlobal('storeFileLocally', stockage.storeFileLocally)
vi.stubGlobal('deleteFile', stockage.deleteFile)

import { moveTemporaryFile } from '../../../../server/utils/file-helpers'

/**
 * Où l'affiche d'une édition est rangée — constat B3.
 *
 * ## ⚠️ LE DÉFAUT
 *
 * La création d'édition avait ses propres fonctions de déplacement (`move-temp-image.ts`), et elles
 * étaient fausses sur trois points :
 *
 * - le dossier de stockage y était écrit **en dur** (`/uploads`), donc `NUXT_FILE_STORAGE_MOUNT`
 *   était ignoré ;
 * - elles appelaient `copyToOutputPublic`, qui lit sa source sous `public/` là où le fichier venait
 *   d'être écrit sous le montage : en production, **chaque création d'édition avec affiche**
 *   écrivait « Erreur lors de la copie vers .output/public » dans les journaux — pour un mécanisme
 *   que la route `/uploads/**` a rendu inutile ;
 * - la seconde branche cherchait le fichier sous `public/uploads/temp/`, **où rien n'est jamais
 *   écrit** : une URL temporaire autre que `NEW_EDITION` laissait l'édition pointer vers
 *   `/uploads/temp/…`, que la purge horaire effaçait une heure plus tard.
 *
 * Les deux fichiers sont supprimés : la création passe par `handleFileUpload`, celui que la
 * **modification** d'une édition employait déjà.
 *
 * ## ⚠️⚠️ CE QUI REND CES CAS NON CREUX
 *
 * Ce qui se mesure est le **dossier temporaire demandé à nuxt-file-storage**. C'est précisément ce
 * que la branche morte calculait de travers : elle le reconstruisait à partir de l'identifiant de
 * la ressource, alors qu'il faut le lire sur l'URL reçue — le fichier a été déposé AVANT que
 * l'édition existe, sous un placeholder.
 *
 * Le témoin est l'URL d'un dépôt fait sous un identifiant NUMÉRIQUE : les deux cas doivent marcher
 * par le même chemin, sinon on a rétabli les deux branches qu'on vient de réunir.
 */
describe('l’affiche d’une édition est rangée sous le montage', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    /*
     * ⚠️ UN VRAI FICHIER SUR LE DISQUE. `moveTemporaryFile` LIT le fichier temporaire
     * (`readFile`) avant de le confier au stockage final : pointer vers un chemin inexistant fait
     * échouer le déplacement, et les cas tombaient alors sur `success: false` — en accusant la
     * dérivation du dossier, qui était pourtant juste.
     */
    const dossier = await mkdtemp(join(tmpdir(), 'affiche-'))
    const fichier = join(dossier, 'brouillon.png')
    await writeFile(fichier, Buffer.from([0x89, 0x50, 0x4e, 0x47]))

    stockage.getFileLocally.mockReturnValue(fichier)
    stockage.storeFileLocally.mockResolvedValue('edition-7-abcd.png')
    stockage.deleteFile.mockResolvedValue(undefined)
  })

  /** Le dossier temporaire demandé à nuxt-file-storage pour retrouver le fichier. */
  const dossierTemporaireLu = () => stockage.getFileLocally.mock.calls.at(-1)![1]

  /** Le dossier final où le fichier est écrit. */
  const dossierFinalEcrit = () => stockage.storeFileLocally.mock.calls.at(-1)![2]

  it('⚠️ LIT LE DOSSIER TEMPORAIRE SUR L’URL, pas sur l’identifiant de l’édition', async () => {
    /*
     * L'affiche d'une édition qui n'existe pas encore est déposée sous `NEW_EDITION`. Reconstruire
     * le dossier à partir de l'identifiant réel — 7 — ne désignerait rien.
     */
    const resultat = await moveTemporaryFile('/uploads/temp/editions/NEW_EDITION/brouillon.png', {
      resourceId: 7,
      resourceType: 'editions',
    })

    expect(dossierTemporaireLu()).toBe('temp/editions/NEW_EDITION')
    expect(resultat.success).toBe(true)
    expect(resultat.filename).toBe('edition-7-abcd.png')
  })

  it('range le fichier sous `editions/<id>`', async () => {
    /*
     * La création écrivait sous `conventions/<id>`, la modification sous `editions/<id>`. Deux
     * dossiers pour la même affiche selon le geste : c'est ce que l'unification supprime.
     */
    await moveTemporaryFile('/uploads/temp/editions/NEW_EDITION/brouillon.png', {
      resourceId: 7,
      resourceType: 'editions',
    })

    expect(dossierFinalEcrit()).toBe('editions/7')
  })

  it('efface le fichier temporaire derrière lui', async () => {
    // L'ancien chemin faisait un `rename`, donc effaçait la source. Le nouveau copie puis supprime :
    // l'oublier laisserait la purge horaire s'en charger, et le montage grossir entre-temps.
    await moveTemporaryFile('/uploads/temp/editions/NEW_EDITION/brouillon.png', {
      resourceId: 7,
      resourceType: 'editions',
    })

    expect(stockage.deleteFile).toHaveBeenCalledWith('brouillon.png', 'temp/editions/NEW_EDITION')
  })

  it('marche aussi pour un dépôt fait sous un identifiant numérique', async () => {
    /*
     * LE TÉMOIN. C'est le cas que la branche morte prétendait traiter : une URL temporaire qui n'est
     * pas `NEW_EDITION`. Elle cherchait le fichier sous `public/uploads/temp/`, où rien n'est jamais
     * écrit, et l'édition gardait une URL `/uploads/temp/…` effacée une heure plus tard. Les deux
     * formes doivent passer par le même chemin.
     */
    // ⚠️ On ne touche PAS à `getFileLocally` : ce qu'on mesure est le dossier qu'on lui DEMANDE,
    // tiré de l'URL. Lui faire rendre un chemin inexistant ferait échouer la lecture du fichier et
    // le cas tomberait sur `success: false`, pour une raison qui n'est pas la sienne.
    const resultat = await moveTemporaryFile('/uploads/temp/editions/3/photo.png', {
      resourceId: 7,
      resourceType: 'editions',
    })

    expect(dossierTemporaireLu()).toBe('temp/editions/3')
    expect(dossierFinalEcrit()).toBe('editions/7')
    expect(resultat.success).toBe(true)
  })

  it('refuse une URL qui n’est pas temporaire', async () => {
    /*
     * SECOND TÉMOIN. Une affiche déjà rangée ne doit pas être redéplacée : la chercher sous `temp/`
     * échouerait, et le `catch` rendrait le nom de fichier nu — l'édition perdrait son affiche à la
     * première modification sans image.
     */
    const resultat = await moveTemporaryFile('/uploads/editions/7/deja-rangee.png', {
      resourceId: 7,
      resourceType: 'editions',
    })

    expect(resultat.success).toBe(false)
    expect(stockage.getFileLocally).not.toHaveBeenCalled()
  })
})
