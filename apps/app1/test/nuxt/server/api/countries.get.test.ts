import { describe, it, expect, beforeEach, vi } from 'vitest'

import handler from '../../../../server/api/countries.get'
import { global } from '../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * Les pays proposés dans les filtres de l'accueil — constat A8.
 *
 * ## ⚠️ DEUX DÉFAUTS, SUR UNE ROUTE PUBLIQUE
 *
 * 1. `new Date(startDate)` n'était pas validé : `?startDate=abc` donnait une `Invalid Date` que
 *    Prisma refuse — un **500 journalisé** sur une saisie d'URL. N'importe qui pouvait remplir le
 *    journal d'erreurs en modifiant un paramètre.
 * 2. `?name[]=a` passait un **tableau** à `contains`, que Prisma refuse également.
 *
 * Et la réponse partait **hors enveloppe** : le tableau nu, là où 449 des 574 handlers passent par
 * `createSuccessResponse`. Le client devait deviner, point d'API par point d'API, s'il lit `res` ou
 * `res.data` — et ce doute a déjà produit des appels voués à l'échec dans ce dépôt.
 *
 * ## ⚠️⚠️ CE QUI REND CES CAS NON CREUX
 *
 * Le mock de Prisma ignore le `where` : un test qui compterait les pays rendus mesurerait ce qu'on a
 * demandé au mock. Ce qui se mesure ici est donc le REFUS (400 au lieu de 500, avant toute requête)
 * et la FORME de la réponse — les deux choses que le lot change.
 */
describe('GET /api/countries', () => {
  const evenement = { context: {} } as never

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    prismaMock.edition.findMany.mockResolvedValue([{ country: 'France' }, { country: 'Belgique' }])
    global.getQuery = vi.fn().mockReturnValue({})
  })

  it('⚠️ REFUSE UNE DATE ILLISIBLE, et ne la passe pas à Prisma', async () => {
    /*
     * C'est le 500 que n'importe quel visiteur pouvait provoquer. Le second `expect` est le plus
     * important : la requête ne doit même pas partir, sinon on a seulement déplacé l'erreur.
     */
    global.getQuery = vi.fn().mockReturnValue({ startDate: 'abc' })

    await expect(handler(evenement)).rejects.toThrow()
    expect(prismaMock.edition.findMany).not.toHaveBeenCalled()
  })

  it('⚠️ REFUSE UN NOM PASSÉ EN TABLEAU', async () => {
    // `?name[]=a` : Prisma refuse un tableau dans `contains`, et c'était un 500 de plus.
    global.getQuery = vi.fn().mockReturnValue({ name: ['a', 'b'] })

    await expect(handler(evenement)).rejects.toThrow()
    expect(prismaMock.edition.findMany).not.toHaveBeenCalled()
  })

  it('accepte une date ISO et un nom ordinaire', async () => {
    /*
     * LE TÉMOIN. Sans lui, un schéma qui refuserait tout satisferait les deux cas ci-dessus — et le
     * sélecteur de pays de l'accueil ne proposerait plus rien, sans que rien ne le dise.
     */
    global.getQuery = vi.fn().mockReturnValue({ startDate: '2026-06-01', name: 'Jong' })

    const reponse = (await handler(evenement)) as { success: boolean; data: string[] }

    expect(reponse.success).toBe(true)
    expect(prismaMock.edition.findMany).toHaveBeenCalled()
  })

  it('accepte aussi une date-heure complète', async () => {
    // Le client peut envoyer l'une ou l'autre forme : n'accepter que `yyyy-mm-dd` casserait un lien
    // déjà partagé qui porte une date-heure.
    global.getQuery = vi.fn().mockReturnValue({ startDate: '2026-06-01T10:00:00Z' })

    await expect(handler(evenement)).resolves.toMatchObject({ success: true })
  })

  it('⚠️ RÉPOND SOUS ENVELOPPE `{ success, data }`', async () => {
    const reponse = (await handler(evenement)) as { success: boolean; data: string[] }

    expect(reponse.success).toBe(true)
    expect(Array.isArray(reponse.data)).toBe(true)
    expect(reponse.data).toContain('France')
  })

  it('rend une enveloppe même quand aucun filtre temporel n’est coché', async () => {
    /*
     * Ce chemin sortait par un `return []` nu — une seconde forme de réponse pour le même point
     * d'API. Le client qui lit `res.data` aurait alors reçu `undefined`, et le sélecteur serait
     * resté vide sans erreur.
     */
    global.getQuery = vi
      .fn()
      .mockReturnValue({ showPast: 'false', showCurrent: 'false', showFuture: 'false' })

    const reponse = (await handler(evenement)) as { success: boolean; data: string[] }

    expect(reponse.success).toBe(true)
    expect(reponse.data).toEqual([])
  })

  it('garde les trois états d’un drapeau temporel', async () => {
    /*
     * ⚠️ LE PIÈGE DE LA VALIDATION. Le corps distingue TROIS états — coché, décoché, absent — et
     * « aucun filtre coché » n'est pas « aucun filtre fourni » : le second rend tous les pays.
     * Convertir les drapeaux en booléens aurait écrasé cette distinction, et le sélecteur se serait
     * vidé dès qu'on décoche la dernière case… ou l'inverse.
     */
    global.getQuery = vi.fn().mockReturnValue({})
    const sansFiltre = (await handler(evenement)) as { data: string[] }
    expect(sansFiltre.data.length).toBeGreaterThan(0)

    global.getQuery = vi.fn().mockReturnValue({ showFuture: 'true' })
    const avecUnFiltre = (await handler(evenement)) as { data: string[] }
    expect(avecUnFiltre.data.length).toBeGreaterThan(0)
  })
})
