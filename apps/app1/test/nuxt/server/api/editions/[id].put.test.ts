import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock des utilitaires - DOIT être avant les imports
vi.mock('../../../../../server/utils/geocoding', () => ({
  geocodeEdition: vi.fn(),
}))

import { geocodeEdition } from '../../../../../server/utils/geocoding'
import handler from '../../../../../server/api/editions/[id]/index.put'
import { global } from '../../../globales-nitro'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

const mockGeocodeEdition = geocodeEdition as ReturnType<typeof vi.fn>

// Mock nuxt-file-storage
vi.mock('nuxt-file-storage', () => ({
  getFileLocally: vi.fn().mockReturnValue('/tmp/mock/file/path'),
  storeFileLocally: vi.fn().mockResolvedValue('mock-filename.jpg'),
  deleteFile: vi.fn().mockResolvedValue(true),
}))

// Mock fs/promises
vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>()
  return {
    ...actual,
    default: actual,
    readFile: vi.fn().mockResolvedValue(Buffer.from('fake-image-data')),
  }
})

describe('/api/editions/[id] PUT', () => {
  const mockUser = {
    id: 1,
    email: 'user@example.com',
    pseudo: 'testuser',
    nom: 'Test',
    prenom: 'User',
  }

  const mockEdition = {
    id: 1,
    conventionId: 1,
    name: 'Edition 2024',
    description: 'Description test',
    startDate: new Date('2024-06-01'),
    endDate: new Date('2024-06-03'),
    addressLine1: '123 rue Test',
    addressLine2: null,
    postalCode: '75001',
    city: 'Paris',
    region: 'Île-de-France',
    country: 'France',
    latitude: 48.8566,
    longitude: 2.3522,
    imageUrl: null,
    creatorId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    creator: mockUser,
    convention: {
      id: 1,
      name: 'Convention Test',
      authorId: 1,
      organizers: [],
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn()
    global.getRouterParam = vi.fn()

    // Valeurs par défaut pour les mocks
    mockGeocodeEdition.mockResolvedValue({
      latitude: 48.8566,
      longitude: 2.3522,
    })
  })

  it('devrait permettre de modifier une édition', async () => {
    const updateData = {
      name: 'Edition 2024 Modifiée',
      description: 'Nouvelle description',
      city: 'Lyon',
      hasFoodTrucks: true,
      hasToilets: true,
    }

    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.edition.update.mockResolvedValue({
      ...mockEdition,
      ...updateData,
    })

    global.readBody.mockResolvedValue(updateData)

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: '1' },
      },
    }

    const result = await handler(mockEvent as any)

    expect(result.success).toBe(true)
    expect(result.data.name).toBe(updateData.name)
    expect(result.data.description).toBe(updateData.description)
    expect(result.data.city).toBe(updateData.city)

    expect(prismaMock.edition.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        name: updateData.name,
        description: updateData.description,
        city: updateData.city,
        hasFoodTrucks: true,
        hasToilets: true,
      }),
      include: expect.any(Object),
    })
  })

  it('devrait rejeter si utilisateur non authentifié', async () => {
    const mockEvent = {
      context: {
        user: null,
        params: { id: '1' },
      },
    }

    await expect(handler(mockEvent as any)).rejects.toThrow('Unauthorized')
  })

  it('devrait rejeter pour un ID invalide', async () => {
    global.getRouterParam.mockReturnValue('invalid')

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: 'invalid' },
      },
    }

    await expect(handler(mockEvent as any)).rejects.toThrow("ID d'édition invalide")
  })

  it('devrait rejeter si édition non trouvée', async () => {
    global.getRouterParam.mockReturnValue('999')
    prismaMock.edition.findUnique.mockResolvedValue(null)

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: '999' },
      },
    }

    await expect(handler(mockEvent as any)).rejects.toThrow('Données invalides')
  })

  it("devrait rejeter si l'utilisateur n'a pas les droits", async () => {
    const otherUserEdition = {
      ...mockEdition,
      creatorId: 2,
      creator: { id: 2 },
      convention: {
        ...mockEdition.convention,
        authorId: 2,
        organizers: [],
      },
    }

    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(otherUserEdition)

    global.readBody.mockResolvedValue({ name: 'Test' })

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: '1' },
      },
    }

    await expect(handler(mockEvent as any)).rejects.toThrow(
      "Vous n'avez pas les droits pour modifier cette édition"
    )
  })

  it("devrait permettre à l'auteur de la convention de modifier", async () => {
    const conventionAuthorEdition = {
      ...mockEdition,
      creatorId: 2, // Créé par quelqu'un d'autre
      creator: { id: 2 },
      convention: {
        ...mockEdition.convention,
        authorId: 1, // Mais convention appartient à l'utilisateur
      },
    }

    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(conventionAuthorEdition)
    prismaMock.edition.update.mockResolvedValue(conventionAuthorEdition)

    global.readBody.mockResolvedValue({ name: 'Edition Modifiée' })

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: '1' },
      },
    }

    const result = await handler(mockEvent as any)

    expect(result).toBeDefined()
    expect(prismaMock.edition.update).toHaveBeenCalled()
  })

  it('devrait permettre à un organisateur admin de modifier', async () => {
    const organizerEdition = {
      ...mockEdition,
      creatorId: 2,
      creator: { id: 2 },
      convention: {
        ...mockEdition.convention,
        authorId: 2,
        organizers: [
          {
            userId: 1,
            canEditConvention: true,
            canEditAllEditions: true,
            canManageOrganizers: true,
          },
        ],
      },
    }

    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(organizerEdition)
    prismaMock.edition.update.mockResolvedValue(organizerEdition)

    global.readBody.mockResolvedValue({ name: 'Edition Modifiée' })

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: '1' },
      },
    }

    const result = await handler(mockEvent as any)

    expect(result).toBeDefined()
  })

  it('devrait permettre à un organisateur modérateur de modifier', async () => {
    const moderatorEdition = {
      ...mockEdition,
      creatorId: 2,
      creator: { id: 2 },
      convention: {
        ...mockEdition.convention,
        authorId: 2,
        organizers: [
          {
            userId: 1,
            canEditConvention: true,
          },
        ],
      },
    }

    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(moderatorEdition)
    prismaMock.edition.update.mockResolvedValue(moderatorEdition)

    global.readBody.mockResolvedValue({ name: 'Edition Modifiée' })

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: '1' },
      },
    }

    const result = await handler(mockEvent as any)

    expect(result).toBeDefined()
  })

  it('devrait rejeter un organisateur viewer', async () => {
    const viewerEdition = {
      ...mockEdition,
      creatorId: 2,
      creator: { id: 2 },
      convention: {
        ...mockEdition.convention,
        authorId: 2,
        organizers: [], // L'API filtre les VIEWER, donc ils n'apparaissent pas dans les résultats
      },
    }

    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(viewerEdition)

    global.readBody.mockResolvedValue({ name: 'Test' })

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: '1' },
      },
    }

    await expect(handler(mockEvent as any)).rejects.toThrow(
      "Vous n'avez pas les droits pour modifier cette édition"
    )
  })

  it("devrait géocoder lors du changement d'adresse", async () => {
    const { geocodeEdition } = await import('../../../../../server/utils/geocoding')

    const updateData = {
      addressLine1: '456 rue Nouvelle',
      city: 'Marseille',
      postalCode: '13001',
      country: 'France',
    }

    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.edition.update.mockResolvedValue({
      ...mockEdition,
      ...updateData,
    })

    global.readBody.mockResolvedValue(updateData)

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: '1' },
      },
    }

    await handler(mockEvent as any)

    expect(geocodeEdition).toHaveBeenCalledWith({
      addressLine1: updateData.addressLine1,
      addressLine2: null,
      city: updateData.city,
      postalCode: updateData.postalCode,
      country: updateData.country,
    })
  })

  it("devrait gérer l'upload d'image", async () => {
    const updateData = {
      name: 'Edition Modifiée',
      imageUrl: 'simple-filename.jpg', // Test avec un nom de fichier simple
    }

    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.edition.update.mockResolvedValue({
      ...mockEdition,
      name: updateData.name,
      imageUrl: updateData.imageUrl,
    })

    global.readBody.mockResolvedValue(updateData)

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: '1' },
      },
    }

    const result = await handler(mockEvent as any)

    expect(result.data.imageUrl).toBe('simple-filename.jpg')
    expect(prismaMock.edition.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          name: updateData.name,
          imageUrl: updateData.imageUrl,
        }),
      })
    )
  })

  it('devrait valider que la date de fin est après la date de début', async () => {
    const invalidData = {
      startDate: '2024-06-10',
      endDate: '2024-06-05', // Date de fin avant date de début
    }

    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    global.readBody.mockResolvedValue(invalidData)

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: '1' },
      },
    }

    await expect(handler(mockEvent as any)).rejects.toThrow('Données invalides')
  })

  it('devrait gérer les erreurs de base de données', async () => {
    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.edition.update.mockRejectedValue(new Error('Database error'))

    global.readBody.mockResolvedValue({ name: 'Test' })

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: '1' },
      },
    }

    await expect(handler(mockEvent as any)).rejects.toThrow()
  })

  it("ne devrait pas géocoder si l'adresse n'a pas changé", async () => {
    const { geocodeEdition } = await import('../../../../../server/utils/geocoding')

    const updateData = {
      name: 'Nouveau nom seulement',
      description: 'Nouvelle description',
    }

    global.getRouterParam.mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.edition.update.mockResolvedValue({
      ...mockEdition,
      ...updateData,
    })

    global.readBody.mockResolvedValue(updateData)

    const mockEvent = {
      context: {
        user: mockUser,
        params: { id: '1' },
      },
    }

    await handler(mockEvent as any)

    expect(geocodeEdition).not.toHaveBeenCalled()
  })
})

/**
 * Ce qu'on peut VIDER, et ce que la modification enregistrait effectivement.
 *
 * ⚠️ TROIS DÉFAUTS DE LA MÊME FAMILLE, tous silencieux : la saisie part, le serveur répond 200, et
 * l'on retrouve l'ancienne valeur au rechargement. Rien ne signale que rien n'a été écrit.
 *
 * ⚠️ LA SÉMANTIQUE VIENT DU SCHÉMA, et c'est ce qui départage les champs. Dans
 * `updateEditionSchema`, `description`, `region` et `addressLine2` sont `nullable().optional()` :
 * le formulaire envoie `null` quand on vide le champ, et cette absence est une VALEUR à écrire.
 * `addressLine1`, `postalCode`, `city` et `country` sont `min(1).optional()` : ils ne peuvent pas
 * être vides, donc `|| edition.X` y est équivalent — les réécrire « par symétrie » aurait laissé
 * croire qu'ils sont vidables.
 */
describe('/api/editions/[id] PUT — ce qui s’écrit et ce qui se vide', () => {
  const utilisateur = { id: 1, email: 'user@example.com', pseudo: 'testuser' }

  const edition = {
    id: 1,
    conventionId: 1,
    name: 'Edition 2024',
    description: 'Description test',
    startDate: new Date('2024-06-01'),
    endDate: new Date('2024-06-03'),
    addressLine1: '123 rue Test',
    addressLine2: 'Bâtiment B',
    postalCode: '75001',
    city: 'Paris',
    region: 'Île-de-France',
    country: 'France',
    imageUrl: null,
    creatorId: 1,
    convention: { id: 1, name: 'Convention Test', authorId: 1, organizers: [] },
  }

  const evenement = { context: { user: utilisateur, params: { id: '1' } } }

  /** Les données réellement envoyées à Prisma. */
  const ecrit = () => prismaMock.edition.update.mock.calls.at(-1)![0].data

  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn()
    global.getRouterParam = vi.fn().mockReturnValue('1')
    mockGeocodeEdition.mockResolvedValue({ latitude: 48.8566, longitude: 2.3522 })
    prismaMock.edition.findUnique.mockResolvedValue(edition)
    prismaMock.edition.update.mockResolvedValue(edition)
  })

  it('ENREGISTRE le complément d’adresse', async () => {
    /*
     * 🔬 `addressLine2` était simplement ABSENT de `updatedData` : destructuré du corps, utilisé
     * pour le géocodage, et jamais écrit. La CRÉATION l'enregistrait bien — le complément
     * d'adresse se posait donc une fois et ne se corrigeait jamais.
     */
    global.readBody.mockResolvedValue({ addressLine2: 'Bâtiment C, 2e étage' })

    await handler(evenement as any)

    expect(ecrit().addressLine2).toBe('Bâtiment C, 2e étage')
  })

  it('EFFACE le complément d’adresse quand on le vide', async () => {
    global.readBody.mockResolvedValue({ addressLine2: null })

    await handler(evenement as any)

    expect(ecrit().addressLine2).toBeNull()
  })

  it('laisse le complément d’adresse INCHANGÉ quand le corps n’en parle pas', async () => {
    // Un PUT partiel — le formulaire n'envoie pas toujours tout — ne doit rien effacer.
    global.readBody.mockResolvedValue({ city: 'Lyon' })

    await handler(evenement as any)

    expect(ecrit().addressLine2).toBe('Bâtiment B')
  })

  it('EFFACE la description quand on la vide', async () => {
    /*
     * 🔬 `description || edition.description` retombait sur l'ancienne valeur : une description
     * supprimée réapparaissait au rechargement. Le `name`, lui, était déjà correct — c'est ce
     * motif qui est appliqué ici.
     */
    global.readBody.mockResolvedValue({ description: null })

    await handler(evenement as any)

    expect(ecrit().description).toBeNull()
  })

  it('EFFACE la région quand on la vide', async () => {
    global.readBody.mockResolvedValue({ region: null })

    await handler(evenement as any)

    expect(ecrit().region).toBeNull()
  })

  it('laisse description et région INCHANGÉES quand le corps n’en parle pas', async () => {
    global.readBody.mockResolvedValue({ city: 'Lyon' })

    await handler(evenement as any)

    expect(ecrit().description).toBe('Description test')
    expect(ecrit().region).toBe('Île-de-France')
  })

  it('écrit une description vraiment vide, et non l’ancienne', async () => {
    /*
     * ⚠️ LE CAS QUE `||` ATTRAPAIT AUSSI, et qu'un test sur `null` seul laisserait passer : la
     * chaîne vide est également falsy. Selon la façon dont le formulaire vide son champ, c'est
     * l'une ou l'autre qui arrive.
     */
    global.readBody.mockResolvedValue({ description: '' })

    await handler(evenement as any)

    expect(ecrit().description).toBe('')
  })

  it('ne rend PAS vidables les champs d’adresse obligatoires', async () => {
    /*
     * 📍 Le pendant du point précédent, et c'est une garde contre une « correction » par symétrie.
     * `addressLine1`, `postalCode`, `city` et `country` sont `min(1)` au schéma : une chaîne vide
     * est REFUSÉE avant d'arriver au handler. Les aligner sur `!== undefined` n'aurait rien changé
     * au comportement, mais aurait laissé croire qu'on peut les effacer.
     */
    global.readBody.mockResolvedValue({ city: '' })

    await expect(handler(evenement as any)).rejects.toMatchObject({ statusCode: 400 })
  })
})

/**
 * Déplacer une édition vers une AUTRE convention : quel droit cela demande.
 *
 * ⚠️ CE QUI ÉTAIT DEMANDÉ AVANT, et c'était le mauvais droit : `canManageOrganizers` sur la
 * convention cible. L'écart jouait dans les deux sens — un organisateur qui peut CRÉER des
 * éditions ne pouvait pas y en déplacer une, tandis qu'un gestionnaire d'organisateurs SANS droit
 * d'ajout le pouvait. Et rien n'interdisait de déplacer une édition vers une convention ARCHIVÉE,
 * que la création refuse.
 *
 * Or déplacer une édition vers une convention, c'est y créer une édition : c'est donc la règle de
 * la création — `getConventionForEditionCreation` — qui s'applique.
 */
describe('/api/editions/[id] PUT — changer de convention', () => {
  const utilisateur = { id: 7, email: 'org@example.com', pseudo: 'org' }
  const CIBLE = 42

  const edition = {
    id: 1,
    conventionId: 1,
    name: 'Edition 2024',
    description: 'Description',
    startDate: new Date('2024-06-01'),
    endDate: new Date('2024-06-03'),
    addressLine1: '123 rue Test',
    addressLine2: null,
    postalCode: '75001',
    city: 'Paris',
    region: null,
    country: 'France',
    imageUrl: null,
    // L'utilisateur peut bien MODIFIER l'édition : c'est le droit sur la CIBLE qui est en jeu.
    creatorId: 7,
    convention: { id: 1, name: 'Convention source', authorId: 7, organizers: [] },
  }

  const evenement = { context: { user: utilisateur, params: { id: '1' } } }

  /** La convention cible, telle que Prisma la rendrait. */
  const cible = (organisateurs: Record<string, unknown>[], isArchived = false) => ({
    id: CIBLE,
    name: 'Convention cible',
    authorId: 999,
    isArchived,
    organizers: organisateurs,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn().mockResolvedValue({ conventionId: CIBLE })
    global.getRouterParam = vi.fn().mockReturnValue('1')
    mockGeocodeEdition.mockResolvedValue({ latitude: 48.8566, longitude: 2.3522 })
    prismaMock.edition.findUnique.mockResolvedValue(edition)
    prismaMock.edition.update.mockResolvedValue(edition)
  })

  it('ACCEPTE un organisateur qui peut ajouter une édition', async () => {
    /*
     * 🔬 Le cas qui ne passait pas : c'est exactement le droit qu'il faut pour créer une édition
     * dans cette convention, et il ne permettait pas d'y en déplacer une.
     */
    prismaMock.convention.findUnique.mockResolvedValue(
      cible([{ userId: 7, canAddEdition: true, canManageOrganizers: false }])
    )

    await expect(handler(evenement as any)).resolves.toBeTruthy()
  })

  it('REFUSE un gestionnaire d’organisateurs SANS droit d’ajout', async () => {
    /*
     * 🔬 L'autre sens de l'écart, et il est plus gênant : gérer les organisateurs d'une convention
     * n'a rien à voir avec le fait d'y verser une édition entière.
     */
    prismaMock.convention.findUnique.mockResolvedValue(
      cible([{ userId: 7, canAddEdition: false, canManageOrganizers: true }])
    )

    await expect(handler(evenement as any)).rejects.toMatchObject({ statusCode: 403 })
    expect(prismaMock.edition.update).not.toHaveBeenCalled()
  })

  it('ACCEPTE l’auteur de la convention cible', async () => {
    prismaMock.convention.findUnique.mockResolvedValue({ ...cible([]), authorId: 7 })

    await expect(handler(evenement as any)).resolves.toBeTruthy()
  })

  it('REFUSE une convention ARCHIVÉE, par un 409', async () => {
    /*
     * ⚠️ Rien ne l'interdisait : on pouvait déverser une édition vivante dans une convention
     * archivée, que la création refuse pourtant. Le 409 est le code de la création — il dit « pas
     * dans cet état », et non « pas vous ».
     */
    prismaMock.convention.findUnique.mockResolvedValue(
      cible([{ userId: 7, canAddEdition: true }], true)
    )

    await expect(handler(evenement as any)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('rend 404 pour une convention cible introuvable', async () => {
    prismaMock.convention.findUnique.mockResolvedValue(null)

    await expect(handler(evenement as any)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('ne CONTRÔLE RIEN quand la convention ne change pas', async () => {
    /*
     * Un PUT ordinaire porte souvent le `conventionId` courant : le faire passer par le contrôle
     * de la cible exigerait un droit d'ajout pour une simple correction de faute de frappe.
     */
    global.readBody.mockResolvedValue({ conventionId: 1, city: 'Lyon' })

    await expect(handler(evenement as any)).resolves.toBeTruthy()
    expect(prismaMock.convention.findUnique).not.toHaveBeenCalled()
  })
})
