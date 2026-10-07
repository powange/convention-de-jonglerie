import { describe, it, expect } from 'vitest'

import { estUnJustificatifPdf } from '../../../shared/utils/justificatif-pdf'

describe('estUnJustificatifPdf', () => {
  it('reconnaît un PDF, quelle que soit la casse de son extension', () => {
    expect(estUnJustificatifPdf('/uploads/conventions/1/editions/2/artists/f.pdf')).toBe(true)
    expect(estUnJustificatifPdf('/uploads/conventions/1/editions/2/artists/f.PDF')).toBe(true)
  })

  it('ignore la requête', () => {
    // Un `?v=` sert à contourner un cache : il ne change pas la nature du fichier.
    expect(estUnJustificatifPdf('/uploads/editions/2/f.pdf?v=3')).toBe(true)
  })

  it('refuse une image', () => {
    expect(estUnJustificatifPdf('/uploads/editions/2/ticket.jpg')).toBe(false)
    expect(estUnJustificatifPdf('/uploads/editions/2/ticket.webp')).toBe(false)
  })

  it('refuse l’absence de justificatif', () => {
    expect(estUnJustificatifPdf(null)).toBe(false)
    expect(estUnJustificatifPdf(undefined)).toBe(false)
    expect(estUnJustificatifPdf('')).toBe(false)
  })

  it('ne se laisse pas prendre à « pdf » ailleurs que dans l’extension', () => {
    // Le piège d'un `includes('.pdf')` : ce fichier est une image.
    expect(estUnJustificatifPdf('/uploads/editions/2/facture.pdf.jpg')).toBe(false)
    expect(estUnJustificatifPdf('/uploads/editions/2/pdf/ticket.jpg')).toBe(false)
  })
})
