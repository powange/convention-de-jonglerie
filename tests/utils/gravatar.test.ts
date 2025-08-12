import { describe, it, expect, vi } from 'vitest'
import { getGravatarUrl, useGravatar } from '../../app/utils/gravatar'

// Mock md5
vi.mock('md5', () => ({
  default: vi.fn((input: string) => {
    // Simuler un hash MD5 pour les tests - générer un hash basé sur l'input
    let hash = ''
    for (let i = 0; i < input.length; i++) {
      hash += input.charCodeAt(i).toString(16)
    }
    // Compléter ou tronquer à 32 caractères (longueur MD5)
    hash = hash.padEnd(32, '0').substring(0, 32)
    return hash
  })
}))

describe('gravatar utils', () => {
  describe('getGravatarUrl', () => {
    it('devrait générer une URL Gravatar correcte', () => {
      const email = 'test@example.com'
      const url = getGravatarUrl(email)
      
      // Le hash MD5 mocké pour "test@example.com" est "74657374406578616d706c652e636f6d"
      expect(url).toBe('https://www.gravatar.com/avatar/74657374406578616d706c652e636f6d?s=80&d=mp')
    })

    it('devrait normaliser l\'email (minuscules et trim)', () => {
      const email = '  TEST@EXAMPLE.COM  '
      const url = getGravatarUrl(email)
      
      // Après normalisation, c'est le même hash que pour "test@example.com"
      expect(url).toBe('https://www.gravatar.com/avatar/74657374406578616d706c652e636f6d?s=80&d=mp')
    })

    it('devrait utiliser la taille spécifiée', () => {
      const email = 'test@example.com'
      const url = getGravatarUrl(email, 200)
      
      expect(url).toContain('s=200')
    })

    it('devrait utiliser l\'image par défaut spécifiée', () => {
      const email = 'test@example.com'
      const url = getGravatarUrl(email, 80, 'robohash')
      
      expect(url).toContain('d=robohash')
    })

    it('devrait retourner une chaîne vide pour un email vide', () => {
      expect(getGravatarUrl('')).toBe('')
      expect(getGravatarUrl(null as any)).toBe('')
      expect(getGravatarUrl(undefined as any)).toBe('')
    })

    it('devrait utiliser les valeurs par défaut', () => {
      const email = 'user@test.com'
      const url = getGravatarUrl(email)
      
      expect(url).toContain('s=80') // Taille par défaut
      expect(url).toContain('d=mp') // Image par défaut (mystery person)
    })

    it('devrait gérer différents formats d\'email', () => {
      const emails = [
        'simple@domain.com',
        'user.name@domain.co.uk',
        'user+tag@domain.com',
        'user123@sub.domain.com'
      ]
      
      emails.forEach(email => {
        const url = getGravatarUrl(email)
        expect(url).toMatch(/^https:\/\/www\.gravatar\.com\/avatar\/[a-f0-9]+\?s=\d+&d=\w+$/)
      })
    })

    it('devrait générer des URLs différentes pour des emails différents', () => {
      const email1 = 'user1@example.com'
      const email2 = 'user2@example.com'
      
      const url1 = getGravatarUrl(email1)
      const url2 = getGravatarUrl(email2)
      
      expect(url1).not.toBe(url2)
    })

    it('devrait gérer les caractères spéciaux dans l\'email', () => {
      const email = 'üser@domain.com'
      const url = getGravatarUrl(email)
      
      expect(url).toMatch(/^https:\/\/www\.gravatar\.com\/avatar\/[a-f0-9]+\?s=80&d=mp$/)
    })

    it('devrait supporter différentes options d\'image par défaut', () => {
      const email = 'test@example.com'
      const defaultImages = ['mp', 'identicon', 'monsterid', 'wavatar', 'retro', 'robohash', 'blank']
      
      defaultImages.forEach(defaultImg => {
        const url = getGravatarUrl(email, 80, defaultImg)
        expect(url).toContain(`d=${defaultImg}`)
      })
    })

    it('devrait supporter différentes tailles', () => {
      const email = 'test@example.com'
      const sizes = [1, 80, 200, 512]
      
      sizes.forEach(size => {
        const url = getGravatarUrl(email, size)
        expect(url).toContain(`s=${size}`)
      })
    })
  })

  describe('useGravatar composable', () => {
    it('devrait retourner une fonction getUserAvatar', () => {
      const { getUserAvatar } = useGravatar()
      
      expect(typeof getUserAvatar).toBe('function')
    })

    it('devrait utiliser getUserAvatar pour générer une URL', () => {
      const { getUserAvatar } = useGravatar()
      const email = 'test@example.com'
      
      const url = getUserAvatar(email)
      
      expect(url).toBe('https://www.gravatar.com/avatar/74657374406578616d706c652e636f6d?s=80&d=mp')
    })

    it('devrait supporter la taille personnalisée dans getUserAvatar', () => {
      const { getUserAvatar } = useGravatar()
      const email = 'test@example.com'
      
      const url = getUserAvatar(email, 120)
      
      expect(url).toContain('s=120')
    })

    it('devrait utiliser mystery person par défaut', () => {
      const { getUserAvatar } = useGravatar()
      const email = 'test@example.com'
      
      const url = getUserAvatar(email)
      
      expect(url).toContain('d=mp')
    })
  })
})