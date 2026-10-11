import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockDemarrer = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

/*
 * Le départ du changement d'adresse est éprouvé à part (`changement-d-adresse.test.ts`) : ici on
 * vérifie que le handler l'appelle QUAND IL FAUT, et qu'il n'écrit plus l'adresse lui-même.
 */
vi.mock('#server/utils/changement-d-adresse', () => ({
  demarrerChangementDAdresse: mockDemarrer,
}))

import handler from '../../../../../server/api/profile/update.put'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * Modifier son profil — et surtout : ce que ce point d'API fait de l'ADRESSE (constat B2).
 *
 * ## ⚠️⚠️ CE FICHIER ÉTAIT ENTIÈREMENT CREUX, et c'est la trouvaille de ce lot
 *
 * Il portait un commentaire désarmant — « Créer un handler simplifié pour les tests » — suivi d'une
 * RECOPIE de la logique du handler dans le fichier de tests. Ses huit cas éprouvaient donc cette
 * copie, et **jamais** le point d'API : ils sont restés verts quand j'ai retiré l'écriture de
 * l'adresse du vrai handler. Un fichier de tests qui réimplémente sa cible ne couvre rien — ce
 * dépôt l'avait déjà payé sur le middleware `super-admin`.
 *
 * Il importe désormais le vrai handler, et `validateAndSanitize` n'est PAS bouchonné : c'est le
 * vrai schéma qui tourne, celui qui accepte maintenant `currentPassword`.
 *
 * ## Le défaut que ces cas gardent
 *
 * L'adresse s'écrivait immédiatement, sans vérification et sans un mot à l'ancienne. Une faute de
 * frappe rendait la réinitialisation de mot de passe impossible, on pouvait s'attribuer l'adresse
 * d'un autre et bloquer son inscription, et une session volée devenait une prise de contrôle
 * définitive.
 */
const MOI = 7
const MON_ADRESSE = 'camille@exemple.test'

const compte = { id: MOI, email: MON_ADRESSE, pseudo: 'camille', isGlobalAdmin: false }
const evenement = { context: { user: compte } }

/** Le corps minimal que le schéma accepte : pseudo et adresse sont requis. */
const corps = (extra: Record<string, unknown> = {}) => ({
  pseudo: 'camille',
  email: MON_ADRESSE,
  ...extra,
})

/** Les données réellement soumises à `prisma.user.update`. */
const donneesEcrites = () => (prismaMock.user.update.mock.calls.at(-1)?.[0] as any).data

describe('PUT /api/profile/update', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDemarrer.mockResolvedValue({ pendingEmail: 'nouvelle@exemple.test' })
    prismaMock.user.findUnique.mockReset()
    prismaMock.user.findUnique.mockResolvedValue(null)
    prismaMock.user.update.mockReset()
    prismaMock.user.update.mockResolvedValue({ id: MOI, email: MON_ADRESSE, pseudo: 'camille' })
    global.readBody.mockReset()
  })

  it('enregistre les champs ordinaires du profil', async () => {
    global.readBody.mockResolvedValue(corps({ prenom: 'Camille', nom: 'Martin' }))

    const res: any = await handler(evenement as any)

    expect(res.success).toBe(true)
    expect(donneesEcrites()).toMatchObject({ pseudo: 'camille', prenom: 'Camille', nom: 'Martin' })
  })

  it('⚠️ N’ÉCRIT JAMAIS L’ADRESSE, même quand elle change', async () => {
    global.readBody.mockResolvedValue(
      corps({ email: 'nouvelle@exemple.test', currentPassword: 'secret' })
    )

    await handler(evenement as any)

    const data = donneesEcrites()
    // Ni l'adresse, ni son empreinte : celle-ci décide du Gravatar affiché, et l'adresse n'est pas
    // encore la sienne.
    expect(data).not.toHaveProperty('email')
    expect(data).not.toHaveProperty('emailHash')
  })

  it('⚠️ DÉMARRE LE CHANGEMENT EN DEUX TEMPS, mot de passe transmis', async () => {
    global.readBody.mockResolvedValue(
      corps({ email: 'nouvelle@exemple.test', currentPassword: 'secret' })
    )

    const res: any = await handler(evenement as any)

    expect(mockDemarrer).toHaveBeenCalledWith({
      userId: MOI,
      nouvelleAdresse: 'nouvelle@exemple.test',
      motDePasseFourni: 'secret',
    })
    // La réponse le DIT : sans cela, l'écran annoncerait « enregistré » et l'ancienne adresse
    // reviendrait dans le champ sans explication.
    expect(res.data.pendingEmail).toBe('nouvelle@exemple.test')
  })

  it('ne démarre RIEN quand l’adresse ne change pas', async () => {
    /*
     * LE TÉMOIN. Sans lui, un handler qui lancerait la procédure à chaque enregistrement
     * satisferait les deux cas précédents — et l'on recevrait un code à six chiffres pour avoir
     * corrigé son prénom.
     */
    global.readBody.mockResolvedValue(corps({ prenom: 'Camille' }))

    const res: any = await handler(evenement as any)

    expect(mockDemarrer).not.toHaveBeenCalled()
    expect(res.data.pendingEmail).toBeNull()
  })

  it('relaie le refus du changement d’adresse au lieu de l’avaler', async () => {
    /*
     * Le mot de passe manquant, le mot de passe faux et l'adresse déjà prise sont des refus de
     * l'util. Les avaler écrirait le reste du profil en laissant croire que l'adresse a changé.
     */
    mockDemarrer.mockRejectedValue(
      Object.assign(new Error('Mot de passe actuel requis'), { statusCode: 400 })
    )
    global.readBody.mockResolvedValue(corps({ email: 'nouvelle@exemple.test' }))

    await expect(handler(evenement as any)).rejects.toThrow('Mot de passe actuel requis')
    // Et RIEN n'est écrit : le profil n'est pas à moitié enregistré.
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('refuse un pseudo déjà pris', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 99, pseudo: 'quelquun' })
    global.readBody.mockResolvedValue(corps({ pseudo: 'quelquun' }))

    await expect(handler(evenement as any)).rejects.toThrow(/pseudo/i)
  })

  it('rejette un corps invalide', async () => {
    // Le vrai schéma tourne : un pseudo trop court ne passe pas.
    global.readBody.mockResolvedValue({ pseudo: 'x', email: MON_ADRESSE })

    await expect(handler(evenement as any)).rejects.toThrow()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })
})
