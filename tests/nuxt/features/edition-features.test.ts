import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from '../../__mocks__/prisma';

describe('Fonctionnalités des éditions', () => {
  const mockUser = {
    id: 1,
    email: 'user@example.com',
    pseudo: 'testuser',
    nom: 'Test',
    prenom: 'User'
  }

  const mockEdition = {
    id: 1,
    name: 'Edition 2024',
    conventionId: 1,
    creatorId: 1
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Posts et commentaires', () => {
    const mockPost = {
      id: 1,
      editionId: 1,
      authorId: 1,
      content: 'Contenu du post',
      createdAt: new Date(),
      author: mockUser
    }

    it('devrait créer un post', async () => {
      const postData = {
        content: 'Nouveau post sur l\'édition'
      }

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionPost.create.mockResolvedValue({
        ...mockPost,
        ...postData
      })

      const createPost = async (editionId: number, data: typeof postData, userId: number) => {
        const edition = await prismaMock.edition.findUnique({
          where: { id: editionId }
        })

        if (!edition) {
          throw new Error('Edition not found')
        }

        return await prismaMock.editionPost.create({
          data: {
            editionId,
            authorId: userId,
            content: data.content
          },
          include: { author: true }
        })
      }

      const result = await createPost(1, postData, mockUser.id)

      expect(result.content).toBe(postData.content)
      expect(result.authorId).toBe(mockUser.id)
      expect(prismaMock.editionPost.create).toHaveBeenCalled()
    })

    it('devrait ajouter un commentaire à un post', async () => {
      const commentData = {
        content: 'Super post !'
      }

      prismaMock.editionPost.findUnique.mockResolvedValue(mockPost)
      prismaMock.editionPostComment.create.mockResolvedValue({
        id: 1,
        postId: 1,
        authorId: mockUser.id,
        content: commentData.content,
        createdAt: new Date(),
        author: mockUser
      })

      const addComment = async (postId: number, data: typeof commentData, userId: number) => {
        const post = await prismaMock.editionPost.findUnique({
          where: { id: postId }
        })

        if (!post) {
          throw new Error('Post not found')
        }

        return await prismaMock.editionPostComment.create({
          data: {
            postId,
            authorId: userId,
            content: data.content
          },
          include: { author: true }
        })
      }

      const result = await addComment(1, commentData, mockUser.id)

      expect(result.content).toBe(commentData.content)
      expect(result.postId).toBe(1)
      expect(prismaMock.editionPostComment.create).toHaveBeenCalled()
    })

    it('devrait récupérer les posts d\'une édition', async () => {
      const posts = [
        { ...mockPost, id: 1, content: 'Premier post' },
        { ...mockPost, id: 2, content: 'Deuxième post' }
      ]

      prismaMock.editionPost.findMany.mockResolvedValue(posts)

      const getPosts = async (editionId: number) => {
        return await prismaMock.editionPost.findMany({
          where: { editionId },
          include: {
            author: true,
            comments: {
              include: { author: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        })
      }

      const result = await getPosts(1)

      expect(result).toHaveLength(2)
      expect(result[0].content).toBe('Premier post')
      expect(result[1].content).toBe('Deuxième post')
    })

    it('devrait supprimer un post par son auteur', async () => {
      prismaMock.editionPost.findUnique.mockResolvedValue(mockPost)
      prismaMock.editionPost.delete.mockResolvedValue(mockPost)

      const deletePost = async (postId: number, userId: number) => {
        const post = await prismaMock.editionPost.findUnique({
          where: { id: postId }
        })

        if (!post) {
          throw new Error('Post not found')
        }

        if (post.authorId !== userId) {
          throw new Error('Unauthorized')
        }

        return await prismaMock.editionPost.delete({
          where: { id: postId }
        })
      }

      const result = await deletePost(1, mockUser.id)

      expect(result.id).toBe(1)
      expect(prismaMock.editionPost.delete).toHaveBeenCalled()
    })

    it('devrait rejeter la suppression par un autre utilisateur', async () => {
      prismaMock.editionPost.findUnique.mockResolvedValue({
        ...mockPost,
        authorId: 2 // Différent utilisateur
      })

      const deletePost = async (postId: number, userId: number) => {
        const post = await prismaMock.editionPost.findUnique({
          where: { id: postId }
        })

        if (!post) {
          throw new Error('Post not found')
        }

        if (post.authorId !== userId) {
          throw new Error('Unauthorized')
        }

        return null
      }

      await expect(deletePost(1, mockUser.id)).rejects.toThrow('Unauthorized')
    })
  })

  describe('Objets trouvés', () => {
    const mockLostItem = {
      id: 1,
      editionId: 1,
      name: 'Portefeuille noir',
      description: 'Trouvé près de la scène principale',
      imageUrl: null,
      foundDate: new Date('2024-06-02'),
      foundLocation: 'Scène principale',
      isReturned: false,
      createdById: 1,
      createdBy: mockUser
    }

    it('devrait déclarer un objet trouvé', async () => {
      const itemData = {
        name: 'Clés de voiture',
        description: 'Trouvées sur le parking',
        foundLocation: 'Parking',
        foundDate: '2024-06-02'
      }

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.lostFoundItem.create.mockResolvedValue({
        ...mockLostItem,
        ...itemData,
        foundDate: new Date(itemData.foundDate)
      })

      const reportLostItem = async (editionId: number, data: typeof itemData, userId: number) => {
        const edition = await prismaMock.edition.findUnique({
          where: { id: editionId }
        })

        if (!edition) {
          throw new Error('Edition not found')
        }

        return await prismaMock.lostFoundItem.create({
          data: {
            editionId,
            name: data.name,
            description: data.description,
            foundLocation: data.foundLocation,
            foundDate: new Date(data.foundDate),
            isReturned: false,
            createdById: userId
          },
          include: { createdBy: true }
        })
      }

      const result = await reportLostItem(1, itemData, mockUser.id)

      expect(result.name).toBe(itemData.name)
      expect(result.foundLocation).toBe(itemData.foundLocation)
      expect(result.isReturned).toBe(false)
      expect(prismaMock.lostFoundItem.create).toHaveBeenCalled()
    })

    it('devrait marquer un objet comme rendu', async () => {
      prismaMock.lostFoundItem.findUnique.mockResolvedValue(mockLostItem)
      prismaMock.lostFoundItem.update.mockResolvedValue({
        ...mockLostItem,
        isReturned: true,
        returnedDate: new Date(),
        returnedToName: 'Jean Dupont',
        returnedToContact: 'jean@example.com'
      })

      const markAsReturned = async (itemId: number, returnInfo: any, userId: number) => {
        const item = await prismaMock.lostFoundItem.findUnique({
          where: { id: itemId }
        })

        if (!item) {
          throw new Error('Item not found')
        }

        // Vérifier les permissions (créateur ou admin)
        if (item.createdById !== userId) {
          throw new Error('Unauthorized')
        }

        return await prismaMock.lostFoundItem.update({
          where: { id: itemId },
          data: {
            isReturned: true,
            returnedDate: new Date(),
            returnedToName: returnInfo.name,
            returnedToContact: returnInfo.contact
          }
        })
      }

      const result = await markAsReturned(
        1, 
        { name: 'Jean Dupont', contact: 'jean@example.com' },
        mockUser.id
      )

      expect(result.isReturned).toBe(true)
      expect(result.returnedToName).toBe('Jean Dupont')
      expect(prismaMock.lostFoundItem.update).toHaveBeenCalled()
    })

    it('devrait lister les objets trouvés', async () => {
      const items = [
        { ...mockLostItem, id: 1, name: 'Portefeuille' },
        { ...mockLostItem, id: 2, name: 'Téléphone', isReturned: true },
        { ...mockLostItem, id: 3, name: 'Clés' }
      ]

      prismaMock.lostFoundItem.findMany.mockResolvedValue(items)

      const getLostItems = async (editionId: number, includeReturned = false) => {
        const where = includeReturned 
          ? { editionId }
          : { editionId, isReturned: false }

        return await prismaMock.lostFoundItem.findMany({
          where,
          include: {
            createdBy: true,
            comments: true
          },
          orderBy: { foundDate: 'desc' }
        })
      }

      const nonReturnedItems = await getLostItems(1, false)
      const allItems = await getLostItems(1, true)

      expect(allItems).toHaveLength(3)
      expect(nonReturnedItems.filter(i => !i.isReturned)).toHaveLength(2)
    })

    it('devrait ajouter un commentaire sur un objet trouvé', async () => {
      const commentData = {
        content: 'Je pense que c\'est le mien, il a une photo de chat dedans'
      }

      prismaMock.lostFoundItem.findUnique.mockResolvedValue(mockLostItem)
      prismaMock.lostFoundComment.create.mockResolvedValue({
        id: 1,
        itemId: 1,
        authorId: mockUser.id,
        content: commentData.content,
        createdAt: new Date(),
        author: mockUser
      })

      const addComment = async (itemId: number, data: typeof commentData, userId: number) => {
        const item = await prismaMock.lostFoundItem.findUnique({
          where: { id: itemId }
        })

        if (!item) {
          throw new Error('Item not found')
        }

        return await prismaMock.lostFoundComment.create({
          data: {
            itemId,
            authorId: userId,
            content: data.content
          },
          include: { author: true }
        })
      }

      const result = await addComment(1, commentData, mockUser.id)

      expect(result.content).toBe(commentData.content)
      expect(result.itemId).toBe(1)
      expect(prismaMock.lostFoundComment.create).toHaveBeenCalled()
    })

    it('devrait permettre de rechercher dans les objets trouvés', () => {
      const items = [
        { id: 1, name: 'Portefeuille noir', description: 'Cuir noir avec cartes' },
        { id: 2, name: 'Téléphone Samsung', description: 'Galaxy S21 noir' },
        { id: 3, name: 'Clés de voiture', description: 'Renault avec porte-clés rouge' }
      ]

      const searchItems = (query: string) => {
        const searchTerm = query.toLowerCase()
        return items.filter(item => 
          item.name.toLowerCase().includes(searchTerm) ||
          item.description.toLowerCase().includes(searchTerm)
        )
      }

      const blackItems = searchItems('noir')
      const keyItems = searchItems('clés')

      expect(blackItems).toHaveLength(2)
      expect(blackItems[0].name).toContain('Portefeuille')
      expect(keyItems).toHaveLength(1)
      expect(keyItems[0].name).toContain('Clés')
    })
  })

  describe('Covoiturage', () => {
    const mockCarpoolOffer = {
      id: 1,
      editionId: 1,
      driverId: 1,
      departureCity: 'Paris',
      departureDate: new Date('2024-06-01T08:00:00'),
      availableSeats: 3,
      price: 15,
      contact: 'driver@example.com',
      driver: mockUser
    }

    const mockCarpoolRequest = {
      id: 1,
      editionId: 1,
      passengerId: 1,
      departureCity: 'Lyon',
      desiredDate: new Date('2024-06-01'),
      seatsNeeded: 2,
      contact: 'passenger@example.com',
      passenger: mockUser
    }

    it('devrait créer une offre de covoiturage', async () => {
      const offerData = {
        departureCity: 'Marseille',
        departureDate: '2024-06-01T10:00:00',
        availableSeats: 4,
        price: 20,
        contact: 'mycontact@example.com'
      }

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.carpoolOffer.create.mockResolvedValue({
        ...mockCarpoolOffer,
        ...offerData,
        departureDate: new Date(offerData.departureDate)
      })

      const createOffer = async (editionId: number, data: typeof offerData, userId: number) => {
        const edition = await prismaMock.edition.findUnique({
          where: { id: editionId }
        })

        if (!edition) {
          throw new Error('Edition not found')
        }

        return await prismaMock.carpoolOffer.create({
          data: {
            editionId,
            driverId: userId,
            departureCity: data.departureCity,
            departureDate: new Date(data.departureDate),
            availableSeats: data.availableSeats,
            price: data.price,
            contact: data.contact
          },
          include: { driver: true }
        })
      }

      const result = await createOffer(1, offerData, mockUser.id)

      expect(result.departureCity).toBe(offerData.departureCity)
      expect(result.availableSeats).toBe(offerData.availableSeats)
      expect(result.price).toBe(offerData.price)
      expect(prismaMock.carpoolOffer.create).toHaveBeenCalled()
    })

    it('devrait créer une demande de covoiturage', async () => {
      const requestData = {
        departureCity: 'Toulouse',
        desiredDate: '2024-06-01',
        seatsNeeded: 1,
        contact: 'need-ride@example.com'
      }

      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.carpoolRequest.create.mockResolvedValue({
        ...mockCarpoolRequest,
        ...requestData,
        desiredDate: new Date(requestData.desiredDate)
      })

      const createRequest = async (editionId: number, data: typeof requestData, userId: number) => {
        const edition = await prismaMock.edition.findUnique({
          where: { id: editionId }
        })

        if (!edition) {
          throw new Error('Edition not found')
        }

        return await prismaMock.carpoolRequest.create({
          data: {
            editionId,
            passengerId: userId,
            departureCity: data.departureCity,
            desiredDate: new Date(data.desiredDate),
            seatsNeeded: data.seatsNeeded,
            contact: data.contact
          },
          include: { passenger: true }
        })
      }

      const result = await createRequest(1, requestData, mockUser.id)

      expect(result.departureCity).toBe(requestData.departureCity)
      expect(result.seatsNeeded).toBe(requestData.seatsNeeded)
      expect(prismaMock.carpoolRequest.create).toHaveBeenCalled()
    })

    it('devrait matcher les offres et demandes', () => {
      const offers = [
        { id: 1, departureCity: 'Paris', availableSeats: 3, departureDate: new Date('2024-06-01T08:00') },
        { id: 2, departureCity: 'Lyon', availableSeats: 2, departureDate: new Date('2024-06-01T10:00') },
        { id: 3, departureCity: 'Paris', availableSeats: 1, departureDate: new Date('2024-06-02T08:00') }
      ]

      const requests = [
        { id: 1, departureCity: 'Paris', seatsNeeded: 2, desiredDate: new Date('2024-06-01') },
        { id: 2, departureCity: 'Lyon', seatsNeeded: 1, desiredDate: new Date('2024-06-01') }
      ]

      const matchCarpools = (offers: any[], requests: any[]) => {
        return requests.map(request => {
          const matches = offers.filter(offer => {
            const sameCity = offer.departureCity === request.departureCity
            const enoughSeats = offer.availableSeats >= request.seatsNeeded
            const sameDay = offer.departureDate.toDateString() === request.desiredDate.toDateString()
            return sameCity && enoughSeats && sameDay
          })

          return {
            request,
            matches
          }
        })
      }

      const matched = matchCarpools(offers, requests)

      expect(matched[0].matches).toHaveLength(1) // Paris request -> 1 offer
      expect(matched[0].matches[0].id).toBe(1)
      expect(matched[1].matches).toHaveLength(1) // Lyon request -> 1 offer
      expect(matched[1].matches[0].id).toBe(2)
    })

    it('devrait permettre de filtrer les covoiturages par ville', () => {
      const offers = [
        { id: 1, departureCity: 'Paris' },
        { id: 2, departureCity: 'Lyon' },
        { id: 3, departureCity: 'Paris' },
        { id: 4, departureCity: 'Marseille' }
      ]

      const filterByCity = (items: any[], city: string) => {
        return items.filter(item => item.departureCity === city)
      }

      const parisOffers = filterByCity(offers, 'Paris')

      expect(parisOffers).toHaveLength(2)
      expect(parisOffers[0].departureCity).toBe('Paris')
      expect(parisOffers[1].departureCity).toBe('Paris')
    })
  })

  describe('Statistiques des éditions', () => {
    it('devrait calculer le taux de remplissage des services', () => {
      const edition = {
        hasFoodTrucks: true,
        hasKidsZone: true,
        acceptsPets: false,
        hasTentCamping: true,
        hasTruckCamping: false,
        hasToilets: true,
        hasShowers: true,
        hasWorkshops: false
      }

      const calculateServiceRate = (services: Record<string, boolean>) => {
        const total = Object.keys(services).length
        const active = Object.values(services).filter(v => v === true).length
        return (active / total) * 100
      }

      const rate = calculateServiceRate(edition)

      expect(rate).toBe(62.5) // 5/8 * 100
    })

    it('devrait compter les interactions par type', () => {
      const interactions = [
        { type: 'post', count: 15 },
        { type: 'comment', count: 42 },
        { type: 'lostItem', count: 8 },
        { type: 'carpoolOffer', count: 12 },
        { type: 'carpoolRequest', count: 6 }
      ]

      const totalInteractions = interactions.reduce((sum, item) => sum + item.count, 0)
      const mostActive = interactions.reduce((max, item) => 
        item.count > max.count ? item : max
      )

      expect(totalInteractions).toBe(83)
      expect(mostActive.type).toBe('comment')
      expect(mostActive.count).toBe(42)
    })

    it('devrait calculer la durée de l\'édition', () => {
      const calculateDuration = (startDate: Date, endDate: Date) => {
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        return diffDays
      }

      const duration = calculateDuration(
        new Date('2024-06-01'),
        new Date('2024-06-03')
      )

      expect(duration).toBe(2)
    })

    it('devrait déterminer le statut temporel de l\'édition', () => {
      const getEditionStatus = (startDate: Date, endDate: Date) => {
        const now = new Date()
        
        if (now < startDate) return 'upcoming'
        if (now > endDate) return 'past'
        return 'ongoing'
      }

      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)

      expect(getEditionStatus(futureDate, new Date(futureDate.getTime() + 86400000))).toBe('upcoming')
      expect(getEditionStatus(pastDate, new Date(pastDate.getTime() + 86400000))).toBe('past')
      expect(getEditionStatus(yesterday, tomorrow)).toBe('ongoing')
    })
  })

  describe('Validation et limites', () => {
    it('devrait limiter la longueur des posts', () => {
      const validatePostLength = (content: string) => {
        const maxLength = 5000
        if (content.length > maxLength) {
          throw new Error('Post too long')
        }
        return true
      }

      const shortPost = 'Un court message'
      const longPost = 'A'.repeat(5001)

      expect(() => validatePostLength(shortPost)).not.toThrow()
      expect(() => validatePostLength(longPost)).toThrow('Post too long')
    })

    it('devrait valider le nombre de places de covoiturage', () => {
      const validateSeats = (seats: number) => {
        if (seats < 1 || seats > 8) {
          throw new Error('Invalid number of seats')
        }
        return true
      }

      expect(() => validateSeats(0)).toThrow('Invalid number of seats')
      expect(() => validateSeats(3)).not.toThrow()
      expect(() => validateSeats(9)).toThrow('Invalid number of seats')
    })

    it('devrait valider le prix du covoiturage', () => {
      const validatePrice = (price: number) => {
        if (price < 0 || price > 100) {
          throw new Error('Invalid price')
        }
        return true
      }

      expect(() => validatePrice(-5)).toThrow('Invalid price')
      expect(() => validatePrice(20)).not.toThrow()
      expect(() => validatePrice(150)).toThrow('Invalid price')
    })

    it('devrait limiter le nombre d\'objets trouvés par utilisateur', () => {
      const maxItemsPerUser = 10
      const userItems = Array.from({ length: 11 }, (_, i) => ({ id: i + 1 }))

      const canAddMoreItems = userItems.length < maxItemsPerUser

      expect(canAddMoreItems).toBe(false)
    })
  })
})