import { describe, it, expect, vi, beforeEach } from 'vitest'

import { createDefaultFaqPorts } from '../../../../../server/faq/ports/default-binding'

// Mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

describe('port directory du module FAQ (câblage jonglerie)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getFaqVisibility', () => {
    it('lit les flags faqEnabled/faqPagePublic de l’Edition', async () => {
      prismaMock.edition.findUnique.mockResolvedValue({ faqEnabled: true, faqPagePublic: true })

      const res = await createDefaultFaqPorts().directory.getFaqVisibility(10)

      expect(res).toEqual({ enabled: true, pagePublic: true })
      expect(prismaMock.edition.findUnique).toHaveBeenCalledWith({
        where: { id: 10 },
        select: { faqEnabled: true, faqPagePublic: true },
      })
    })

    it('module activé mais page publique masquée', async () => {
      prismaMock.edition.findUnique.mockResolvedValue({ faqEnabled: true, faqPagePublic: false })
      expect(await createDefaultFaqPorts().directory.getFaqVisibility(10)).toEqual({
        enabled: true,
        pagePublic: false,
      })
    })

    it('édition introuvable → tout désactivé (pas de fuite)', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(null)
      expect(await createDefaultFaqPorts().directory.getFaqVisibility(999)).toEqual({
        enabled: false,
        pagePublic: false,
      })
    })
  })
})
