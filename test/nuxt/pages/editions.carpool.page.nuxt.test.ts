import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { renderRawPage } from '../utils/renderPage'

describe('Page /editions/[id]/carpool', () => {
  let page: any

  beforeAll(async () => {
    // Rendre la page une seule fois pour tous les tests
    page = await renderRawPage('/editions/1/carpool')
  })

  afterAll(() => {
    // Nettoyer après tous les tests
    if (page?.unmount) {
      page.unmount()
    }
  })

  it('smoke: devrait charger la page carpool', () => {
    // La page peut afficher soit le contenu carpool, soit le message not_found si l'édition n'existe pas
    expect(page.html()).toMatch(
      /covoiturage|carpool|offre|demande|offer|request|loading|editions\.loading_details|editions\.not_found/i
    )
  })
})
