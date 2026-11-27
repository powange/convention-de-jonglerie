/**
 * Câblage du layer FAQ pour Flowvent : la visibilité de la FAQ se lit sur l'ÉVÉNEMENT (cf.
 * layers/faq/server/ports/types.ts ; app1 fournit le sien, sur ses éditions).
 */
import type { FaqPorts } from '#faq/server/ports/types'

const ports: FaqPorts = {
  directory: {
    async getFaqVisibility(editionId) {
      const e = await prisma.event.findUnique({
        where: { id: editionId },
        select: { faqEnabled: true, faqPagePublic: true },
      })
      return { enabled: e?.faqEnabled === true, pagePublic: e?.faqPagePublic === true }
    },
    async setFaqPagePublic(editionId, pagePublic) {
      await prisma.event.update({ where: { id: editionId }, data: { faqPagePublic: pagePublic } })
    },
  },
}

export function useFaqPorts(): FaqPorts {
  return ports
}
