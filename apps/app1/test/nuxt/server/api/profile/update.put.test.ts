import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockDemarrer = vi.hoisted(() => vi.fn())
const mockEffacer = vi.hoisted(() => vi.fn())
const mockRafraichirSession = vi.hoisted(() => vi.fn())

/*
 * ⚠️ LES TROIS FONCTIONS DE FICHIERS SONT DES AUTO-IMPORTS de nuxt-file-storage : un
 * `vi.mock('nuxt-file-storage')` ne les intercepte PAS, la globale est la seule prise. Quatrième
 * fois que ce dépôt le paie.
 */
vi.hoisted(() => {
  const g = globalThis as any
  g.getFileLocally = vi.fn(() => '/mount/temp/profiles/7/abc.png')
  g.storeFileLocally = vi.fn(async () => 'def456.png')
  g.deleteFile = vi.fn(async () => undefined)
})

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

/*
 * L'effacement physique est éprouvé là où il vit (`image-deletion`) : ici on vérifie qu'il est
 * APPELÉ, et avec la valeur lue en base — c'est tout l'objet des constats B3 et B4.
 */
vi.mock('#server/utils/photo-de-profil', () => ({
  effacerAnciennePhoto: mockEffacer,
}))

/*
 * Le rafraîchissement de la session est éprouvé dans `session-glissante.test.ts` — ce qui se
 * vérifie ici est qu'il est APPELÉ, et avec quoi (constat B5).
 */
vi.mock('#server/utils/session-helpers', () => ({
  rafraichirUtilisateurDeSession: mockRafraichirSession,
}))

/*
 * ⚠️ LE HANDLER LIT RÉELLEMENT LE FICHIER TEMPORAIRE (`await import('fs/promises')`) pour le
 * réencoder : sans ce bouchon, le cas du remplacement échoue sur un ENOENT, et l'échec est AVALÉ
 * par le `catch` du handler — on croirait tester le remplacement en mesurant le chemin d'erreur.
 * Seul `readFile` est remplacé, le reste du module demeure.
 */
vi.mock('fs/promises', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  readFile: vi.fn(async () => Buffer.from('une image', 'utf8')),
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

/** La photo que la BASE porte, réglée cas par cas — la session, elle, n'en porte aucune. */
const photoEnBase = { valeur: null as string | null }

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
    /*
     * ⚠️ DEUX LECTURES SUR LE MÊME MODÈLE : le contrôle d'unicité du pseudo, et la photo courante.
     * Le bouchon ignorant le `where`, il faut répondre selon ce qui est DEMANDÉ — sans quoi la
     * photo courante prend la réponse destinée à l'unicité, et les cas mesurent n'importe quoi.
     */
    prismaMock.user.findUnique.mockImplementation(async (args: any) =>
      args?.select?.profilePicture ? { profilePicture: photoEnBase.valeur } : null
    )
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
  /**
   * ⚠️⚠️ LES PHOTOS DE PROFIL N'ÉTAIENT JAMAIS EFFACÉES — constats B3 et B4.
   *
   * Deux occasions, aucune ne le faisait :
   *
   * 1. le REMPLACEMENT stockait la nouvelle image et laissait la précédente sur le disque ;
   * 2. le RETRAIT testait `user.profilePicture` — lu dans la SESSION, qui ne porte que `id`,
   *    `email`, `pseudo` et `isGlobalAdmin`. La condition était donc structurellement FAUSSE pour
   *    tout compte à mot de passe : personne n'effaçait jamais rien, le disque ne faisait que
   *    grossir, et la personne croyait avoir retiré une image toujours servie par `/api/uploads`.
   *
   * 📍 CE QUE LA MESURE A CORRIGÉ DANS LA FICHE. Elle nommait QUATRE chemins ; deux sont déjà
   * refermés. `DELETE /api/profile/delete-picture` fonctionne — `extractFilePath`, qu'elle
   * incrimine, n'existe plus : la réécriture de #648 lit la valeur EN BASE et délègue à
   * `deleteOldFile`. Et la purge des temporaires existe aussi, en tâche planifiée
   * (`cleanup-temp-uploads`, délai de grâce d'une heure, là où la fiche demandait d'en écrire une
   * à vingt-quatre heures). La revérification du 9 octobre affirmait que #648 n'avait traité que
   * les éditions ; c'est inexact.
   */
  describe('photo de profil', () => {
    beforeEach(() => {
      photoEnBase.valeur = 'ancienne.png'
    })

    it('⚠️ EFFACE L’ANCIENNE PHOTO AU REMPLACEMENT, avec la valeur lue EN BASE', async () => {
      global.readBody.mockResolvedValue(
        corps({ profilePicture: '/uploads/temp/profiles/7/abc.png' })
      )

      await handler(evenement as any)

      expect(mockEffacer).toHaveBeenCalledWith('ancienne.png', MOI)
      // Et c'est bien la NOUVELLE qui est enregistrée.
      expect(donneesEcrites().profilePicture).toBe('def456.png')
    })

    it('⚠️ EFFACE L’ANCIENNE PHOTO AU RETRAIT — la branche était morte', async () => {
      global.readBody.mockResolvedValue(corps({ profilePicture: null }))

      await handler(evenement as any)

      expect(mockEffacer).toHaveBeenCalledWith('ancienne.png', MOI)
      expect(donneesEcrites().profilePicture).toBeNull()
    })

    it('n’efface rien quand la photo n’est pas touchée', async () => {
      /*
       * LE TÉMOIN. Sans lui, un handler qui effacerait à CHAQUE enregistrement satisferait les deux
       * cas précédents — et corriger son prénom retirerait sa photo.
       */
      global.readBody.mockResolvedValue(corps({ prenom: 'Camille' }))

      await handler(evenement as any)

      expect(mockEffacer).not.toHaveBeenCalled()
      expect(donneesEcrites()).not.toHaveProperty('profilePicture')
    })

    it('n’efface rien quand il n’y avait aucune photo', async () => {
      photoEnBase.valeur = null
      global.readBody.mockResolvedValue(corps({ profilePicture: null }))

      await handler(evenement as any)

      expect(mockEffacer).toHaveBeenCalledWith(null, MOI)
    })

    it('⚠️ REFUSE EN 500 SI LE DÉPLACEMENT ÉCHOUE, sans rien écrire', async () => {
      /*
       * Constat B4. Le `catch` enregistrait le nom du fichier TEMPORAIRE « en cas d'erreur » :
       * l'adresse construite ensuite — `/uploads/profiles/<id>/abc.png` — n'existe pas, et la
       * personne voyait une image CASSÉE partout où elle apparaît, avec un 200 et un message de
       * succès. Un refus franc laisse l'ancienne photo en place.
       */
      ;(globalThis as any).getFileLocally.mockReturnValueOnce(null)
      global.readBody.mockResolvedValue(
        corps({ profilePicture: '/uploads/temp/profiles/7/abc.png' })
      )

      await expect(handler(evenement as any)).rejects.toThrow(/réessayez/i)
      expect(prismaMock.user.update).not.toHaveBeenCalled()
      // Et l'ancienne photo n'a surtout PAS été effacée : elle est tout ce qui reste.
      expect(mockEffacer).not.toHaveBeenCalled()
    })
  })
  /**
   * ⚠️⚠️ LA SESSION PORTE UNE COPIE DU COMPTE — constat B5.
   *
   * Elle est scellée dans un cookie, figée à la connexion. Le profil écrivait en base sans que
   * cette copie en sache rien : dix-neuf handlers y lisent `user.email` ou `user.pseudo`, dont
   * « Mes billets », qui cherche les commandes par l'adresse de SESSION. L'écran affichait le
   * pseudo neuf pendant que le serveur raisonnait sur l'ancien — des semaines durant pour qui a
   * coché « se souvenir de moi ».
   */
  describe('rafraîchissement de la session', () => {
    const champsRafraichis = () => mockRafraichirSession.mock.calls.at(-1)?.[1] as any

    it('⚠️ MET À JOUR LES CHAMPS QUE LA SESSION PORTE', async () => {
      prismaMock.user.update.mockResolvedValue({
        id: MOI,
        pseudo: 'camille2',
        nom: 'Martin',
        prenom: 'Camille',
        phone: '0600000000',
      })
      global.readBody.mockResolvedValue(corps({ pseudo: 'camille2' }))

      await handler(evenement as any)

      expect(mockRafraichirSession).toHaveBeenCalled()
      expect(champsRafraichis()).toMatchObject({
        pseudo: 'camille2',
        nom: 'Martin',
        prenom: 'Camille',
        phone: '0600000000',
      })
    })

    it('⚠️ N’Y MET PAS L’ADRESSE, qui ne change plus ici', async () => {
      /*
       * Depuis le constat B2, l'adresse ne bascule qu'à la CONFIRMATION du code. L'écrire dans la
       * session à l'enregistrement y inscrirait une adresse que le compte n'a pas encore — et
       * « Mes billets » chercherait les commandes d'une adresse non confirmée.
       */
      global.readBody.mockResolvedValue(
        corps({ email: 'nouvelle@exemple.test', currentPassword: 'secret' })
      )

      await handler(evenement as any)

      expect(champsRafraichis()).not.toHaveProperty('email')
    })

    it('ne touche aux catégories que si elles sont fournies', async () => {
      /*
       * LE TÉMOIN. Les écrire systématiquement depuis la réponse écraserait les déclarations de la
       * session avec ce que le `select` rend — soit `undefined` pour un corps qui ne les mentionne
       * pas, c'est-à-dire la perte des trois cases à chaque enregistrement du profil.
       */
      global.readBody.mockResolvedValue(corps({ prenom: 'Camille' }))

      await handler(evenement as any)

      const champs = champsRafraichis()
      expect(champs).not.toHaveProperty('isVolunteer')
      expect(champs).not.toHaveProperty('isArtist')
      expect(champs).not.toHaveProperty('isOrganizer')
    })
  })
})
