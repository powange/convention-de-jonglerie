import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockEnvoyer = vi.hoisted(() => vi.fn(async () => true))
const mockComparer = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/emailService', () => ({
  sendEmail: mockEnvoyer,
  generateVerificationCode: () => '123456',
  generateVerificationEmailHtml: async () => '<html>code</html>',
  getSiteUrl: () => 'https://juggling-convention.com',
}))

vi.mock('bcryptjs', () => ({ default: { compare: mockComparer } }))

import {
  confirmerChangementDAdresse,
  demarrerChangementDAdresse,
  renvoyerCodeDeChangement,
} from '../../../../server/utils/changement-d-adresse'

const prismaMock = (globalThis as any).prisma

/**
 * Le changement d'adresse de courriel en deux temps — constat B2.
 *
 * ## Le défaut
 *
 * Le profil écrivait l'adresse immédiatement : aucune vérification, aucun code, aucun message à
 * l'ancienne adresse. Trois conséquences, toutes réelles — une faute de frappe rendait la
 * réinitialisation de mot de passe **impossible** ; on pouvait s'attribuer l'adresse d'un autre et
 * **bloquer son inscription** ; une session volée devenait une prise de contrôle **définitive**.
 *
 * L'inscription, elle, exige un code à six chiffres depuis toujours : le profil contournait cette
 * exigence.
 *
 * ## ⚠️ CE QUE LE BOUCHON NE PEUT PAS PROUVER, et qui est donc asserté sur la FORME
 *
 * Le bouchon central ignore le `where` : faire rendre un compte par `findUnique` ne dit rien de ce
 * qui a été DEMANDÉ. Les cas qui portent le lot assèrent donc ce qui est **écrit** et ce qui est
 * **envoyé**, et la recherche d'unicité est vérifiée par la forme de son appel.
 */
const MOI = 7
const MON_ADRESSE = 'camille@exemple.test'
const NOUVELLE = 'camille.martin@exemple.test'

const compte = (extra: Record<string, unknown> = {}) => ({
  id: MOI,
  email: MON_ADRESSE,
  password: '$2a$hache',
  prenom: 'Camille',
  pseudo: 'camille',
  ...extra,
})

const ecrit = () => (prismaMock.user.update.mock.calls.at(-1)?.[0] as any).data
const destinataires = () => mockEnvoyer.mock.calls.map((appel: any[]) => appel[0].to)

describe('demarrerChangementDAdresse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    /*
     * ⚠️ `clearAllMocks` efface les APPELS, pas les implémentations : le cas « l'envoi échoue »
     * laissait sinon `sendEmail` en rejet pour tous les blocs suivants, qui journalisaient alors
     * des avertissements sans rapport. Piège déjà payé sur le compteur du guichet.
     */
    mockEnvoyer.mockResolvedValue(true)
    mockComparer.mockResolvedValue(true)
    prismaMock.user.findUnique.mockReset()
    prismaMock.user.update.mockReset()
    prismaMock.user.update.mockResolvedValue({ id: MOI })
  })

  /** Le premier `findUnique` rend le compte, le second l'éventuel propriétaire de l'adresse. */
  const avec = (proprietaireExistant: unknown = null, leCompte = compte()) => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce(leCompte)
      .mockResolvedValueOnce(proprietaireExistant)
  }

  it('⚠️ ENREGISTRE LA DEMANDE AVEC SON CODE ET SON ÉCHÉANCE, sans toucher à l’adresse', async () => {
    avec()

    const res = await demarrerChangementDAdresse({
      userId: MOI,
      nouvelleAdresse: NOUVELLE,
      motDePasseFourni: 'secret',
    })

    expect(res).toEqual({ pendingEmail: NOUVELLE })
    const data = ecrit()
    expect(data.pendingEmail).toBe(NOUVELLE)
    expect(data.pendingEmailCode).toBe('123456')
    expect(data.pendingEmailExpiry).toBeInstanceOf(Date)
    // L'adresse du compte n'est PAS touchée : c'est tout l'objet du lot.
    expect(data).not.toHaveProperty('email')
  })

  it('⚠️ ÉCRIT AUX DEUX ADRESSES : le code à la neuve, l’avis à l’ancienne', async () => {
    /*
     * L'avis à l'ancienne adresse est la moitié qui PROTÈGE : si quelqu'un entre dans un compte et
     * change l'adresse, le titulaire l'apprend là où il lit encore son courrier. Sans lui, le vol
     * serait silencieux.
     */
    avec()

    await demarrerChangementDAdresse({
      userId: MOI,
      nouvelleAdresse: NOUVELLE,
      motDePasseFourni: 'secret',
    })

    expect(destinataires()).toEqual([NOUVELLE, MON_ADRESSE])
  })

  it('exige le mot de passe quand le compte en a un', async () => {
    avec()

    await expect(
      demarrerChangementDAdresse({ userId: MOI, nouvelleAdresse: NOUVELLE })
    ).rejects.toThrow('Mot de passe actuel requis')
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('refuse un mot de passe faux', async () => {
    avec()
    mockComparer.mockResolvedValue(false)

    await expect(
      demarrerChangementDAdresse({
        userId: MOI,
        nouvelleAdresse: NOUVELLE,
        motDePasseFourni: 'faux',
      })
    ).rejects.toThrow('incorrect')
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('⚠️ N’EXIGE RIEN D’UN COMPTE SANS MOT DE PASSE', async () => {
    /*
     * LE TÉMOIN. Les comptes OAuth n'ont pas de mot de passe : leur en réclamer un rendrait le
     * changement d'adresse IMPOSSIBLE. C'est la même nuance que `change-password`, qui la porte
     * déjà — et une garde posée sans elle fermerait la porte à une population entière.
     */
    avec(null, compte({ password: null }))

    await demarrerChangementDAdresse({ userId: MOI, nouvelleAdresse: NOUVELLE })

    expect(mockComparer).not.toHaveBeenCalled()
    expect(ecrit().pendingEmail).toBe(NOUVELLE)
  })

  it('refuse une adresse déjà portée par un autre compte', async () => {
    avec({ id: 99 })

    await expect(
      demarrerChangementDAdresse({
        userId: MOI,
        nouvelleAdresse: NOUVELLE,
        motDePasseFourni: 'secret',
      })
    ).rejects.toThrow('déjà utilisée')
    // Et l'unicité est bien cherchée sur l'adresse DEMANDÉE, non sur l'actuelle.
    expect(prismaMock.user.findUnique).toHaveBeenLastCalledWith({
      where: { email: NOUVELLE },
      select: { id: true },
    })
  })

  it('un envoi qui échoue n’annule pas la demande', async () => {
    /*
     * Décision assumée : la demande est enregistrée AVANT les envois, et un échec n'est que
     * journalisé. L'inverse — annuler parce qu'un serveur de courriel a hoqueté — rendrait le
     * changement impossible pour une raison qu'on ne contrôle pas, et la personne peut redemander
     * un code.
     */
    avec()
    mockEnvoyer.mockRejectedValue(new Error('SMTP indisponible'))

    await expect(
      demarrerChangementDAdresse({
        userId: MOI,
        nouvelleAdresse: NOUVELLE,
        motDePasseFourni: 'secret',
      })
    ).resolves.toEqual({ pendingEmail: NOUVELLE })
    expect(ecrit().pendingEmail).toBe(NOUVELLE)
  })
})

describe('renvoyerCodeDeChangement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnvoyer.mockResolvedValue(true)
    prismaMock.user.findUnique.mockReset()
    prismaMock.user.update.mockReset()
    prismaMock.user.update.mockResolvedValue({ id: MOI })
  })

  it('réécrit le code et l’échéance, et RIEN d’autre', async () => {
    prismaMock.user.findUnique.mockResolvedValue(compte({ pendingEmail: NOUVELLE }))

    await renvoyerCodeDeChangement(MOI)

    expect(Object.keys(ecrit()).sort()).toEqual(['pendingEmailCode', 'pendingEmailExpiry'])
  })

  it('ne prévient pas une seconde fois l’ancienne adresse', async () => {
    /*
     * Elle a déjà été prévenue. Répéter le message à chaque renvoi apprendrait à ne plus le lire —
     * et c'est ce message qui doit alerter le jour où il compte.
     */
    prismaMock.user.findUnique.mockResolvedValue(compte({ pendingEmail: NOUVELLE }))

    await renvoyerCodeDeChangement(MOI)

    expect(destinataires()).toEqual([NOUVELLE])
  })

  it('refuse quand aucune demande n’est en cours', async () => {
    prismaMock.user.findUnique.mockResolvedValue(compte({ pendingEmail: null }))

    await expect(renvoyerCodeDeChangement(MOI)).rejects.toThrow('Aucun changement')
  })
})

describe('confirmerChangementDAdresse', () => {
  const DEMAIN = new Date(Date.now() + 10 * 60 * 1000)

  beforeEach(() => {
    vi.clearAllMocks()
    mockEnvoyer.mockResolvedValue(true)
    prismaMock.user.findUnique.mockReset()
    prismaMock.user.update.mockReset()
    prismaMock.user.update.mockResolvedValue({ id: MOI })
  })

  const demande = (extra: Record<string, unknown> = {}) => ({
    id: MOI,
    pendingEmail: NOUVELLE,
    pendingEmailCode: '123456',
    pendingEmailExpiry: DEMAIN,
    ...extra,
  })

  it('⚠️ BASCULE L’ADRESSE ET SON EMPREINTE, et vide la demande', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(demande()).mockResolvedValueOnce(null)

    const res = await confirmerChangementDAdresse({ userId: MOI, code: '123456' })

    expect(res.email).toBe(NOUVELLE)
    const data = ecrit()
    expect(data.email).toBe(NOUVELLE)
    // L'empreinte suit l'adresse : c'est elle qui décide du Gravatar affiché.
    expect(data.emailHash).toEqual(expect.any(String))
    expect(data.emailHash).toBe(res.emailHash)
    expect(data).toMatchObject({
      pendingEmail: null,
      pendingEmailCode: null,
      pendingEmailExpiry: null,
    })
  })

  it('refuse un code faux', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(demande()).mockResolvedValueOnce(null)

    await expect(confirmerChangementDAdresse({ userId: MOI, code: '000000' })).rejects.toThrow(
      'invalide'
    )
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('refuse un code périmé', async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce(demande({ pendingEmailExpiry: new Date(Date.now() - 1000) }))
      .mockResolvedValueOnce(null)

    await expect(confirmerChangementDAdresse({ userId: MOI, code: '123456' })).rejects.toThrow(
      'expiré'
    )
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('⚠️ REFUSE EN 409 SI L’ADRESSE A ÉTÉ PRISE ENTRE-TEMPS', async () => {
    /*
     * Ce n'est pas une redondance de la garde du départ : entre la demande et la confirmation,
     * quelqu'un a pu s'inscrire avec cette adresse — ou la confirmer avant nous, deux comptes
     * pouvant parfaitement demander la même. Sans ce contrôle, l'écriture échouerait sur la
     * contrainte d'unicité et un 500 ferait chercher la panne du mauvais côté.
     */
    prismaMock.user.findUnique.mockResolvedValueOnce(demande()).mockResolvedValueOnce({ id: 99 })

    await expect(
      confirmerChangementDAdresse({ userId: MOI, code: '123456' })
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('refuse quand aucune demande n’est en cours', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ id: MOI, pendingEmail: null })

    await expect(confirmerChangementDAdresse({ userId: MOI, code: '123456' })).rejects.toThrow(
      'Aucun changement'
    )
  })
})
