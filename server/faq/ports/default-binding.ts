// Câblage jonglerie des ports du module FAQ. Lit le modèle concret (Edition) pour les flags de
// visibilité. Reste côté app ; le layer faq ne consomme que les interfaces (types.ts).
import type { FaqPorts } from './types'

export function createDefaultFaqPorts(): FaqPorts {
  return {
    directory: {
      // Jonglerie : visibilité = flags `faqEnabled` / `faqPagePublic` portés par l'Edition.
      async getFaqVisibility(editionId) {
        const edition = await prisma.edition.findUnique({
          where: { id: editionId },
          select: { faqEnabled: true, faqPagePublic: true },
        })
        return {
          enabled: edition?.faqEnabled === true,
          pagePublic: edition?.faqPagePublic === true,
        }
      },
    },
  }
}
