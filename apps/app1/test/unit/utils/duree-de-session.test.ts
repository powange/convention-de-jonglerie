import { describe, expect, it } from 'vitest'

import {
  DUREES_DE_SESSION,
  PLAFOND_ABSOLU,
  SEUIL_DE_PROLONGATION,
  decisionDeLecture,
  dureeChoisie,
  dureeDeLaSession,
  echeanceDepuis,
  sessionValide,
  tropVieille,
} from '../../../shared/utils/duree-de-session'

/**
 * La durée de vie d'une session.
 *
 * Ce que ces tests protègent est le défaut S1 : « se souvenir de moi » promettait 90 jours et en
 * donnait 30, comptés depuis une visite qui pouvait précéder la connexion de plusieurs semaines.
 * Le symptôme était une déconnexion sans le moindre signal.
 *
 * La règle ne s'appuie plus sur le `maxAge` de h3 mais sur une échéance portée par la session et
 * repoussée à chaque visite. L'instant de référence est toujours un paramètre : un test qui
 * dépendrait de l'heure courante ne prouverait rien.
 */

const JOUR = 24 * 60 * 60 * 1000
const MAINTENANT = new Date('2026-09-20T12:00:00Z').getTime()

describe('dureeChoisie', () => {
  it('rend 90 jours quand la case est cochée, 30 sinon', () => {
    expect(dureeChoisie(true)).toBe(DUREES_DE_SESSION.prolongee)
    expect(dureeChoisie(false)).toBe(DUREES_DE_SESSION.ordinaire)
    // Et les deux doivent différer, sans quoi la case ne sert à rien — c'était l'option
    // « 90 jours pour tout le monde », écartée précisément pour cette raison.
    expect(DUREES_DE_SESSION.prolongee).toBeGreaterThan(DUREES_DE_SESSION.ordinaire)
  })
})

describe('dureeDeLaSession', () => {
  it('lit la durée rangée dans la session', () => {
    expect(dureeDeLaSession({ dureeSecondes: DUREES_DE_SESSION.prolongee })).toBe(
      DUREES_DE_SESSION.prolongee
    )
  })

  it('retombe sur la durée ordinaire pour une session d’avant la correction', () => {
    // Le choix prudent : on ne prolonge pas de trois mois une session dont on ignore si la case
    // avait été cochée.
    for (const echeance of [null, undefined, {}, { dureeSecondes: null }]) {
      expect(dureeDeLaSession(echeance)).toBe(DUREES_DE_SESSION.ordinaire)
    }
  })

  it('refuse une durée absurde plutôt que de fabriquer une session éternelle', () => {
    expect(dureeDeLaSession({ dureeSecondes: 0 })).toBe(DUREES_DE_SESSION.ordinaire)
    expect(dureeDeLaSession({ dureeSecondes: -1 })).toBe(DUREES_DE_SESSION.ordinaire)
    expect(dureeDeLaSession({ dureeSecondes: Number.NaN })).toBe(DUREES_DE_SESSION.ordinaire)
    expect(dureeDeLaSession({ dureeSecondes: Number.POSITIVE_INFINITY })).toBe(
      DUREES_DE_SESSION.ordinaire
    )
    // Bornée par le haut : dix ans rangés dans une session ne doivent pas être honorés.
    expect(dureeDeLaSession({ dureeSecondes: 10 * 365 * 24 * 3600 })).toBe(
      DUREES_DE_SESSION.prolongee
    )
  })
})

describe('sessionValide', () => {
  it('accepte tant que l’échéance n’est pas atteinte, refuse après', () => {
    expect(sessionValide({ expireAt: MAINTENANT + 1 }, MAINTENANT)).toBe(true)
    expect(sessionValide({ expireAt: MAINTENANT }, MAINTENANT)).toBe(false)
    expect(sessionValide({ expireAt: MAINTENANT - 1 }, MAINTENANT)).toBe(false)
  })

  it('accepte une session sans échéance', () => {
    // Celles posées avant cette correction. Les invalider d'un coup déconnecterait tout le monde
    // au déploiement — pour corriger un défaut dont le symptôme est d'être déconnecté sans
    // prévenir.
    for (const echeance of [null, undefined, {}, { expireAt: null }, { expireAt: Number.NaN }]) {
      expect(sessionValide(echeance, MAINTENANT)).toBe(true)
    }
  })
})

describe('decisionDeLecture', () => {
  it('ne prolonge pas une session encore largement valide', () => {
    // Sans ce frein, chaque requête réécrirait le cookie — y compris celles des images.
    const d = decisionDeLecture(
      { expireAt: MAINTENANT + 80 * JOUR, dureeSecondes: DUREES_DE_SESSION.prolongee },
      MAINTENANT
    )
    expect(d).toEqual({ valide: true, prolonger: false })
  })

  it('prolonge quand il reste moins que le seuil', () => {
    // 40 jours restants sur 90 : en dessous de la moitié, on repousse.
    const d = decisionDeLecture(
      { expireAt: MAINTENANT + 40 * JOUR, dureeSecondes: DUREES_DE_SESSION.prolongee },
      MAINTENANT
    )
    expect(d.valide).toBe(true)
    expect(d.prolonger).toBe(true)
    expect(d.nouvelleEcheance).toBe(MAINTENANT + 90 * JOUR)
  })

  it('repart de la durée PLEINE, et c’est tout l’objet du glissement', () => {
    // Le défaut corrigé : l'échéance valait `createdAt + durée` et n'était jamais repoussée.
    // Ici, une session à bout de souffle retrouve sa durée entière parce que la personne est
    // revenue — c'est ce qu'on attend d'un « se souvenir de moi ».
    const d = decisionDeLecture(
      { expireAt: MAINTENANT + 1000, dureeSecondes: DUREES_DE_SESSION.prolongee },
      MAINTENANT
    )
    expect(d.nouvelleEcheance).toBe(MAINTENANT + 90 * JOUR)
  })

  it('ne ressuscite jamais une session expirée', () => {
    // La frontière compte : une milliseconde après l'échéance, on ne prolonge pas, on refuse.
    const d = decisionDeLecture(
      { expireAt: MAINTENANT - 1, dureeSecondes: DUREES_DE_SESSION.prolongee },
      MAINTENANT
    )
    expect(d).toEqual({ valide: false, prolonger: false })
  })

  it('pose une échéance à une session qui n’en avait pas', () => {
    const d = decisionDeLecture({}, MAINTENANT)
    expect(d.valide).toBe(true)
    expect(d.prolonger).toBe(true)
    // Durée ordinaire, faute de savoir si la case avait été cochée.
    expect(d.nouvelleEcheance).toBe(MAINTENANT + 30 * JOUR)
  })

  it('respecte le seuil pour les deux durées', () => {
    // Le seuil est une PART de la durée, pas un nombre de jours : une session ordinaire doit se
    // prolonger plus tôt en valeur absolue qu'une session de trois mois.
    const bord = (duree: number) => duree * 1000 * SEUIL_DE_PROLONGATION

    const ordinaireJusteAuDessus = decisionDeLecture(
      {
        expireAt: MAINTENANT + bord(DUREES_DE_SESSION.ordinaire) + 1000,
        dureeSecondes: DUREES_DE_SESSION.ordinaire,
      },
      MAINTENANT
    )
    expect(ordinaireJusteAuDessus.prolonger).toBe(false)

    const ordinaireJusteEnDessous = decisionDeLecture(
      {
        expireAt: MAINTENANT + bord(DUREES_DE_SESSION.ordinaire) - 1000,
        dureeSecondes: DUREES_DE_SESSION.ordinaire,
      },
      MAINTENANT
    )
    expect(ordinaireJusteEnDessous.prolonger).toBe(true)
  })

  it('n’est jamais « prolonger » sans nouvelle échéance', () => {
    // L'appelant écrit `nouvelleEcheance` ; un `prolonger: true` sans valeur poserait une
    // échéance indéfinie, c'est-à-dire une session que plus rien ne ferme.
    for (const restant of [-1, 0, 1000, 10 * JOUR, 80 * JOUR]) {
      const d = decisionDeLecture(
        { expireAt: MAINTENANT + restant, dureeSecondes: DUREES_DE_SESSION.prolongee },
        MAINTENANT
      )
      if (d.prolonger) expect(typeof d.nouvelleEcheance).toBe('number')
    }
  })
})

describe('echeanceDepuis', () => {
  it('compte en millisecondes à partir de l’instant donné', () => {
    expect(echeanceDepuis(MAINTENANT, DUREES_DE_SESSION.ordinaire)).toBe(MAINTENANT + 30 * JOUR)
  })
})

describe('le plafond absolu', () => {
  it('borne ce que le glissement peut prolonger', () => {
    // La fenêtre glissante a un défaut qu'elle ne peut pas corriger seule : elle ne distingue
    // pas le propriétaire du voleur. Sans plafond, qui détient le cookie le garde vivant en
    // passant de temps en temps — alors qu'avant la correction il mourait en trente jours.
    expect(PLAFOND_ABSOLU).toBeGreaterThan(DUREES_DE_SESSION.prolongee)
  })

  it('refuse une session ouverte il y a plus d’un an, même tenue en vie', () => {
    const ouverture = MAINTENANT - (PLAFOND_ABSOLU * 1000 + 1)
    const session = {
      ouvertureAt: ouverture,
      // Échéance repoussée hier encore : c'est exactement le cas du cookie volé et entretenu.
      expireAt: MAINTENANT + 80 * JOUR,
      dureeSecondes: DUREES_DE_SESSION.prolongee,
    }
    expect(tropVieille(session, MAINTENANT)).toBe(true)
    expect(sessionValide(session, MAINTENANT)).toBe(false)
    expect(decisionDeLecture(session, MAINTENANT)).toEqual({ valide: false, prolonger: false })
  })

  it('accepte jusqu’à la veille du plafond', () => {
    const session = {
      ouvertureAt: MAINTENANT - (PLAFOND_ABSOLU * 1000 - 1),
      expireAt: MAINTENANT + 80 * JOUR,
      dureeSecondes: DUREES_DE_SESSION.prolongee,
    }
    expect(tropVieille(session, MAINTENANT)).toBe(false)
  })

  it('ne prolonge jamais au-delà du plafond', () => {
    // Prolonger jusqu'à une date que le plafond rejettera donnerait un cookie annonçant une
    // validité qu'il n'a pas.
    const ouverture = MAINTENANT - (PLAFOND_ABSOLU - 10 * 24 * 3600) * 1000
    const d = decisionDeLecture(
      {
        ouvertureAt: ouverture,
        expireAt: MAINTENANT + 1000,
        dureeSecondes: DUREES_DE_SESSION.prolongee,
      },
      MAINTENANT
    )
    expect(d.prolonger).toBe(true)
    expect(d.nouvelleEcheance).toBe(ouverture + PLAFOND_ABSOLU * 1000)
    // Et cette date est bien AVANT ce que la durée pleine aurait donné.
    expect(d.nouvelleEcheance!).toBeLessThan(MAINTENANT + DUREES_DE_SESSION.prolongee * 1000)
  })

  it('laisse passer une session d’avant la correction, qui n’a pas d’âge connu', () => {
    // On ne sait pas quand elle a été ouverte ; la rejeter déconnecterait tout le monde au
    // déploiement. Elle reçoit un instant d'ouverture à sa première lecture.
    expect(tropVieille({ expireAt: MAINTENANT + 1000 }, MAINTENANT)).toBe(false)
    expect(tropVieille({}, MAINTENANT)).toBe(false)
    expect(tropVieille({ ouvertureAt: null }, MAINTENANT)).toBe(false)
  })
})
