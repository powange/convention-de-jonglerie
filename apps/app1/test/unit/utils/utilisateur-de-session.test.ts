import fs from 'node:fs'
import path from 'node:path'

import { describe, it, expect } from 'vitest'

import { utilisateurDeSession } from '../../../shared/utils/utilisateur-de-session'

/**
 * La copie du compte portée par la session, et le fait qu'elle soit la MÊME partout — constat B9.
 *
 * Le détail du défaut est dans l'en-tête de `shared/utils/utilisateur-de-session.ts` : huit
 * ouvertures de session, cinq formes différentes, et `event.context.user` — que `requireAuth` rend
 * à tous les points d'API — qui changeait selon la façon dont la personne s'était connectée.
 */
const COMPTE = {
  id: 7,
  email: 'lea@exemple.fr',
  pseudo: 'lea',
  nom: 'Martin',
  prenom: 'Léa',
  phone: '0600000000',
  isGlobalAdmin: false,
  isVolunteer: true,
  isArtist: false,
  isOrganizer: true,
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-10-01T00:00:00.000Z'),
  isEmailVerified: true,
}

describe('utilisateurDeSession', () => {
  it('porte les trois catégories — celles qui manquaient à trois ouvertures sur huit', () => {
    const session = utilisateurDeSession(COMPTE)

    expect(session.isVolunteer).toBe(true)
    expect(session.isArtist).toBe(false)
    expect(session.isOrganizer).toBe(true)
  })

  it('⚠️ NE RECOPIE RIEN D’AUTRE QUE SES TREIZE CHAMPS', () => {
    /*
     * ⚠️⚠️ LE CAS LE PLUS IMPORTANT DE CE FICHIER. La session est un cookie SCELLÉ renvoyé au
     * navigateur à chaque requête. Les huit points d'entrée lisent le compte ENTIER (aucun
     * `select`), donc un `...compte` au lieu d'une recopie champ par champ y déverserait le
     * hachage du mot de passe, les codes de vérification et l'adresse en attente de confirmation.
     *
     * Le scellement les rend illisibles pour le porteur du cookie, mais la fuite serait réelle :
     * un secret qui voyage à chaque requête n'a pas à y être, et personne ne l'y verrait.
     */
    const session = utilisateurDeSession({
      ...COMPTE,
      password: '$2b$10$motdepassehache',
      emailVerificationCode: '123456',
      pendingEmail: 'nouvelle@exemple.fr',
      pendingEmailCode: '654321',
      sessionVersion: 3,
    } as never)

    expect(Object.keys(session).sort()).toEqual(Object.keys(COMPTE).sort())
    for (const interdit of [
      'password',
      'emailVerificationCode',
      'pendingEmail',
      'pendingEmailCode',
      'sessionVersion',
    ]) {
      expect(interdit in session, `« ${interdit} » ne doit pas voyager dans la session`).toBe(false)
    }
  })

  it('laisse DEHORS la photo et le hachage d’adresse, et c’est voulu', () => {
    /*
     * Les deux étaient portés par certaines sessions — `profilePicture` par Google et Facebook,
     * `emailHash` par l'usurpation d'identité. Les y garder obligerait à les rafraîchir à chaque
     * changement, soit le défaut B5 créé de toutes pièces pour des champs que personne ne lit
     * dans la session. La démonstration est faite pour `emailHash` : `confirm-email` rafraîchit
     * `email` SANS lui, donc une session qui le porterait afficherait l'avatar de l'ancienne
     * adresse.
     */
    const session = utilisateurDeSession({
      ...COMPTE,
      profilePicture: '/uploads/profiles/7.jpg',
      emailHash: 'd41d8cd98f00b204e9800998ecf8427e',
    } as never)

    expect('profilePicture' in session).toBe(false)
    expect('emailHash' in session).toBe(false)
  })
})

/** Les appels à `ouvrirSession` du dépôt, et ce qu'ils passent comme `user`. */
function ouverturesDeSession(): { fichiers: number; appels: string[]; sansHelper: string[] } {
  const racineDepot = path.resolve(__dirname, '../../../../..')
  const racines = [
    path.resolve(racineDepot, 'apps/app1/server'),
    ...fs
      .readdirSync(path.resolve(racineDepot, 'layers'), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => path.resolve(racineDepot, 'layers', e.name, 'server')),
  ]

  let fichiers = 0
  const appels: string[] = []
  const sansHelper: string[] = []

  const parcours = (dossier: string) => {
    if (!fs.existsSync(dossier)) return
    for (const entree of fs.readdirSync(dossier, { withFileTypes: true })) {
      const complet = path.join(dossier, entree.name)
      if (entree.isDirectory()) {
        parcours(complet)
        continue
      }
      if (!entree.name.endsWith('.ts')) continue
      // Le module qui DÉFINIT `ouvrirSession` n'ouvre aucune session.
      if (entree.name === 'session-helpers.ts') continue
      const src = fs.readFileSync(complet, 'utf8')
      fichiers++
      const relatif = path.relative(racineDepot, complet).split(path.sep).join('/')
      /*
       * ⚠️ DEUX MOTIFS, ET LE SECOND EST LA GARDE DU PREMIER. Le motif détaillé est borné à
       * 400 caractères : un appel plus long ne mordrait pas, et serait EXEMPTÉ en silence. On
       * compte donc séparément les occurrences du seul nom `ouvrirSession(`, et le test compare
       * les deux comptes — c'est la seule façon de savoir que le balayage n'a rien laissé passer.
       */
      const reperes = (src.match(/\bouvrirSession\(/g) ?? []).length
      for (let i = 0; i < reperes; i++) appels.push(relatif)

      let analyses = 0
      for (const appel of src.matchAll(/ouvrirSession\(([\s\S]{0,400}?)\n\s*\)/g)) {
        analyses++
        if (!appel[1]!.includes('utilisateurDeSession(')) sansHelper.push(relatif)
      }

      // Un appel repéré mais non analysé est traité comme NON CONFORME : mieux vaut un reproche
      // nommé, qu'on vient lire, qu'une exemption que personne ne voit.
      for (let i = analyses; i < reperes; i++) {
        sansHelper.push(`${relatif} (appel non analysé : trop long pour le motif)`)
      }
    }
  }
  racines.forEach(parcours)
  return { fichiers, appels, sansHelper }
}

describe('toutes les ouvertures de session passent par le helper', () => {
  it('⚠️ AUCUNE N’ÉCRIT SON PROPRE OBJET `user`', () => {
    /*
     * LA GARDE ANTI-DIVERGENCE. Cinq formes coexistaient sans que rien ne les compare, et c'est
     * la nature du défaut : chaque recopie est juste à sa façon, aucune n'est signalée, et
     * l'écart ne se voit qu'en mettant les huit côte à côte. Une neuvième ouverture écrite à la
     * main tombe ici.
     */
    expect(
      ouverturesDeSession().sansHelper,
      'ces points ouvrent une session avec un objet `user` écrit sur place : passer par ' +
        '`utilisateurDeSession(compte)`, sinon la session qu’ils posent diverge des sept autres'
    ).toEqual([])
  })

  it('⚠️ LES HUIT OUVERTURES SONT BIEN TROUVÉES — pas une de moins', () => {
    /*
     * Le chiffre est figé parce que c'est l'étendue mesurée du sujet : formulaire, Google,
     * Facebook, vérification d'adresse, invitation, mot de passe, usurpation d'identité et fin
     * d'usurpation. Une neuvième porte d'entrée fait tomber ce cas, et celui qui l'ouvre doit
     * venir la déclarer ici — c'est la seule façon de ne pas la découvrir par un défaut.
     */
    expect(ouverturesDeSession().appels).toHaveLength(8)
  })

  it('le balayage lit bien des fichiers — il ne conclut pas sur le vide', () => {
    /*
     * Le cas ci-dessus est une INTERDICTION, donc vert sur une liste vide : une erreur de chemin
     * le laisserait au vert tout en ne vérifiant plus rien. On mesure ce qui est LU, jamais la
     * taille de la dette — qui vaut zéro ici et doit pouvoir y rester.
     */
    expect(ouverturesDeSession().fichiers).toBeGreaterThan(200)
  })
})
