import { describe, it, expect } from 'vitest'

import {
  estUneDateReelle,
  importSchema,
  parseDateWithTimezone,
} from '../../../../../server/api/admin/import-edition.post'

// Payload minimal valide (uniquement les champs requis).
const validBase = () => ({
  convention: { name: 'Convention Test', email: 'contact@test.org' },
  edition: {
    startDate: '2025-07-15',
    endDate: '2025-07-20',
    addressLine1: '1 rue du Cirque',
    city: 'Paris',
    country: 'France',
    postalCode: '75001',
  },
})

describe('importSchema (import admin d’édition)', () => {
  it('accepte un payload minimal valide', () => {
    expect(importSchema.safeParse(validBase()).success).toBe(true)
  })

  it('accepte une édition SANS nom : chaîne vide', () => {
    const payload = validBase()
    ;(payload.edition as Record<string, unknown>).name = ''
    const res = importSchema.safeParse(payload)
    expect(res.success).toBe(true)
  })

  it('accepte une édition sans nom : null', () => {
    const payload = validBase()
    ;(payload.edition as Record<string, unknown>).name = null
    expect(importSchema.safeParse(payload).success).toBe(true)
  })

  it('accepte une édition sans nom : champ omis', () => {
    expect(importSchema.safeParse(validBase()).success).toBe(true)
  })

  it('accepte un nom d’édition non vide', () => {
    const payload = validBase()
    ;(payload.edition as Record<string, unknown>).name = 'CIJ 2025'
    expect(importSchema.safeParse(payload).success).toBe(true)
  })

  it('refuse un nom de convention vide (c’est le fallback d’affichage)', () => {
    const payload = validBase()
    payload.convention.name = ''
    const res = importSchema.safeParse(payload)
    expect(res.success).toBe(false)
  })

  it('refuse une date de début manquante (champ requis)', () => {
    const payload = validBase()
    delete (payload.edition as Record<string, unknown>).startDate
    expect(importSchema.safeParse(payload).success).toBe(false)
  })
})

/**
 * Une date bien FORMÉE n'est pas une date qui EXISTE.
 *
 * L'expression régulière du schéma ne compte que des chiffres : `2026-13-45` la franchissait, luxon
 * la rejetait ensuite, et le repli construisait un `Invalid Date` que Prisma refusait — l'administrateur
 * recevait une erreur serveur opaque au lieu d'un message nommant le champ.
 *
 * Même famille que le défaut corrigé la veille sur les dates de validité d'un tarif.
 */
describe('dates d’import : la forme ne suffit pas', () => {
  it('refuse une date impossible bien que bien formée', () => {
    for (const impossible of ['2026-13-45', '2026-02-30', '2026-00-10']) {
      const payload = validBase()
      ;(payload.edition as Record<string, unknown>).startDate = impossible
      expect(importSchema.safeParse(payload).success, impossible).toBe(false)
    }
  })

  it('accepte les formes réellement employées', () => {
    for (const bonne of ['2025-07-15', '2025-07-15T14:00:00', '2025-07-15T14:00:00.000Z']) {
      const payload = validBase()
      ;(payload.edition as Record<string, unknown>).startDate = bonne
      expect(importSchema.safeParse(payload).success, bonne).toBe(true)
    }
  })

  it('distingue la forme de l’existence', () => {
    // Le prédicat seul, pour que la raison du refus reste lisible si le schéma change.
    expect(estUneDateReelle('2026-07-15')).toBe(true)
    expect(estUneDateReelle('2026-13-45')).toBe(false)
    expect(estUneDateReelle('2026-02-30')).toBe(false)
  })
})

/**
 * Un fuseau annoncé mais inconnu ne doit pas faire retomber sur UTC.
 *
 * C'est la règle que `versInstant` s'est donnée ailleurs dans ce dépôt : l'appelant croit tenir le
 * fuseau de la convention, et une date fausse en base survit longtemps là où un refus se voit tout
 * de suite. L'import faisait l'inverse — un `console.warn`, puis UTC.
 */
describe('fuseau horaire de l’import', () => {
  it('refuse un fuseau inconnu à l’entrée', () => {
    const payload = validBase()
    ;(payload.edition as Record<string, unknown>).timezone = 'Mars/Olympus_Mons'
    expect(importSchema.safeParse(payload).success).toBe(false)
  })

  it('accepte un fuseau connu, et l’absence de fuseau', () => {
    for (const tz of ['Europe/Paris', 'America/New_York', null, undefined]) {
      const payload = validBase()
      ;(payload.edition as Record<string, unknown>).timezone = tz
      expect(importSchema.safeParse(payload).success, String(tz)).toBe(true)
    }
  })

  it('ancre l’heure sur le fuseau annoncé', () => {
    // Le 15 juillet, Paris est à +02:00 : minuit sur place vaut 22 h UTC la veille.
    expect(parseDateWithTimezone('2025-07-15', 'Europe/Paris').toISOString()).toBe(
      '2025-07-14T22:00:00.000Z'
    )
  })

  it('lève plutôt que d’inventer quand le fuseau est inconnu', () => {
    // La ligne qui compte : avant, cette entrée rendait une date UTC après un simple console.warn.
    expect(() => parseDateWithTimezone('2025-07-15', 'Mars/Olympus_Mons')).toThrow()
  })

  it('retombe sur UTC sans fuseau — cas légitime et courant', () => {
    // Le champ est facultatif, et douze éditions sur quarante-trois n'en déclarent pas.
    expect(parseDateWithTimezone('2025-07-15', null).toISOString()).toBe('2025-07-15T00:00:00.000Z')
  })

  it('respecte un décalage déjà porté par la chaîne', () => {
    // Une date qui porte son propre fuseau est un instant : le fuseau de l'édition ne la retouche pas.
    expect(parseDateWithTimezone('2025-07-15T12:00:00Z', 'Europe/Paris').toISOString()).toBe(
      '2025-07-15T12:00:00.000Z'
    )
  })
})

/**
 * Importer dans une convention qui existe déjà.
 *
 * Le bloc `convention` n'a alors plus lieu d'être : c'est tout l'intérêt du choix, puisque l'IA
 * n'a plus à deviner un nom ni à inventer une adresse de courriel — ce que le prompt l'invitait
 * explicitement à faire (« si non trouvé, utiliser contact@domaine-du-site.com »).
 */
describe('convention d’accueil', () => {
  const sansConvention = () => {
    const payload = validBase() as Record<string, unknown>
    delete payload.convention
    return payload
  }

  it('accepte un identifiant de convention SANS bloc convention', () => {
    expect(importSchema.safeParse({ ...sansConvention(), conventionId: 7 }).success).toBe(true)
  })

  it('refuse un JSON qui n’a NI convention d’accueil NI bloc convention', () => {
    // Sans l'un des deux, on ne sait pas où rattacher l'édition : mieux vaut le dire à la saisie
    // que de créer une convention vide.
    expect(importSchema.safeParse(sansConvention()).success).toBe(false)
  })

  it('accepte les deux à la fois — le bloc sera ignoré, pas refusé', () => {
    // Décision du 22/09 : un JSON parfaitement importable ne doit pas échouer pour une raison de
    // forme. Le handler ignore le bloc et le signale dans sa réponse.
    expect(importSchema.safeParse({ ...validBase(), conventionId: 7 }).success).toBe(true)
  })

  it('refuse un identifiant qui n’en est pas un', () => {
    for (const mauvais of [0, -3, 1.5, '7']) {
      const res = importSchema.safeParse({ ...sansConvention(), conventionId: mauvais })
      expect(res.success, String(mauvais)).toBe(false)
    }
  })

  it('garde le chemin d’origine : un bloc convention seul suffit toujours', () => {
    expect(importSchema.safeParse(validBase()).success).toBe(true)
  })
})

/**
 * L'adresse de la convention : ABSENTE plutôt qu'inventée.
 *
 * C'est elle qui permet à un organisateur de revendiquer sa convention — le code de revendication
 * y est envoyé. Une adresse fabriquée depuis le nom de domaine la lui retire (il ne reçoit jamais
 * rien) ou la donne à qui contrôle cette boîte.
 *
 * Le schéma l'exigeait pourtant, alors que les deux fichiers de règles ordonnent de laisser vide
 * quand on ne la trouve pas : un modèle OBÉISSANT produisait donc un JSON refusé, et le seul
 * chemin qui aboutissait était celui qui inventait. La colonne est nullable en base depuis
 * toujours, et la revendication sait déjà dire « pas d'email configuré ».
 */
describe('adresse de la convention', () => {
  const avecEmail = (valeur: unknown) => {
    const payload = validBase()
    ;(payload.convention as Record<string, unknown>).email = valeur
    return importSchema.safeParse(payload)
  }

  it('accepte une adresse absente, vide ou nulle', () => {
    for (const vide of ['', null]) {
      expect(avecEmail(vide).success, JSON.stringify(vide)).toBe(true)
    }
    const sansChamp = validBase()
    delete (sansChamp.convention as Record<string, unknown>).email
    expect(importSchema.safeParse(sansChamp).success).toBe(true)
  })

  it('accepte toujours une vraie adresse', () => {
    expect(avecEmail('contact@convention.org').success).toBe(true)
  })

  it('refuse une adresse mal formée — le laxisme s’arrête au vide', () => {
    // Accepter l'absence ne veut pas dire accepter n'importe quoi : une chaîne non vide doit
    // rester une adresse, sans quoi le code de revendication partirait dans le vide.
    for (const mauvaise of ['pas-une-adresse', 'a@', '@b.org', 'a b@c.org']) {
      expect(avecEmail(mauvaise).success, mauvaise).toBe(false)
    }
  })
})

/**
 * Le champ que le schéma laissait tomber en silence.
 *
 * `hasUnicycleSpace` existe en base et figure parmi les 25 services proposés à l'IA, mais manquait
 * aux 24 du schéma. Zod n'étant pas `strict`, il l'écartait SANS un mot : le modèle détectait
 * l'espace monocycle, et l'édition était créée sans.
 */
describe('caractéristiques de l’édition', () => {
  it('accepte l’espace monocycle, comme les vingt-quatre autres', () => {
    const payload = validBase()
    ;(payload.edition as Record<string, unknown>).hasUnicycleSpace = true
    const res = importSchema.safeParse(payload)
    expect(res.success).toBe(true)
    // Et surtout : la valeur SURVIT à l'analyse. C'est ce que le test d'acceptation seul ne dirait
    // pas, puisque zod accepte en silence un objet dont il a retiré des clés.
    expect(res.success && (res.data.edition as Record<string, unknown>).hasUnicycleSpace).toBe(true)
  })
})
