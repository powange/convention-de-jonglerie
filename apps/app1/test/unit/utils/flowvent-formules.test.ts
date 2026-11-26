import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/*
 * ⚠️ Lu COMME DU TEXTE puis transpilé, et non importé : un fichier TypeScript d'app2 ne se
 * transforme qu'avec le tsconfig que Nuxt génère dans `apps/app2/.nuxt`, absent de la CI d'app1
 * (« Tsconfig not found »). Même raison que offline-cache-flowvent.test.ts.
 */
const APP2 = resolve(__dirname, '../../../../app2')
const lire = (chemin: string) => readFileSync(resolve(APP2, chemin), 'utf8')

const { outputText } = ts.transpileModule(lire('shared/formules.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
})
const f: Record<string, any> = {}
new Function('exports', outputText)(f)

/**
 * Les formules d'abonnement de Flowvent (`apps/app2/shared/formules.ts`) : la grille À LA TAILLE
 * décidée par l'utilisateur le 26/11/2026 (Découverte gratuite, Association, Festival, Grand
 * festival), leurs plafonds, et la règle « alerte à 80 %, tolérance de 10 %, puis plus d'ajout ».
 */
describe('Flowvent — formules à la taille', () => {
  it('tient la grille décidée (centimes TTC)', () => {
    const prix = Object.fromEntries(f.FORMULES.map((x: any) => [x.cle, x.prix]))
    expect(prix).toEqual({
      decouverte: { monthly: 0, annual: 0 },
      association: { monthly: 900, annual: 8400 },
      festival: { monthly: 1900, annual: 18000 },
      grand: { monthly: 3900, annual: 37200 },
    })
    expect(f.prixMensuel('association', 'annual')).toBe(700)
    expect(f.prixMensuel('festival', 'annual')).toBe(1500)
    expect(f.prixMensuel('grand', 'annual')).toBe(3100)
  })

  it('tient les plafonds décidés (null : illimité)', () => {
    const plafonds = Object.fromEntries(f.FORMULES.map((x: any) => [x.cle, x.plafonds]))
    expect(plafonds).toEqual({
      decouverte: { evenements: 1, benevoles: 15, artistes: 5, organisateurs: 1 },
      association: { evenements: 1, benevoles: 75, artistes: 20, organisateurs: 3 },
      festival: { evenements: 5, benevoles: 250, artistes: 60, organisateurs: 10 },
      grand: { evenements: 15, benevoles: 1000, artistes: 200, organisateurs: null },
    })
  })

  it('les plafonds ne baissent jamais en montant de formule', () => {
    for (let i = 1; i < f.FORMULES.length; i++) {
      for (const c of f.COMPTEURS) {
        const avant = f.FORMULES[i - 1].plafonds[c.cle]
        const apres = f.FORMULES[i].plafonds[c.cle]
        expect(
          apres === null || (avant !== null && apres >= avant),
          `${c.cle} en ${f.FORMULES[i].cle}`
        ).toBe(true)
      }
    }
  })

  it('la formule gratuite ne se souscrit pas et ne se remise pas', () => {
    expect(f.CLES_FORMULES).toEqual(['association', 'festival', 'grand'])
    expect(f.estFormulePayante('decouverte')).toBe(false)
    expect(f.estFormulePayante('festival')).toBe(true)
    expect(f.estFormulePayante('integral')).toBe(false)
  })

  it('tolère 10 % au-delà du plafond, arrondi à l’inférieur', () => {
    expect(f.plafondTolere(75)).toBe(82)
    expect(f.plafondTolere(250)).toBe(275)
    expect(f.plafondTolere(3)).toBe(3)
    expect(f.plafondTolere(null)).toBeNull()
  })

  it('accepte un ajout jusqu’à la marge, pas au-delà', () => {
    expect(f.peutAjouter(81, 75)).toBe(true)
    expect(f.peutAjouter(82, 75)).toBe(false)
    expect(f.peutAjouter(80, 75, 3)).toBe(false)
    expect(f.peutAjouter(0, 1)).toBe(true)
    expect(f.peutAjouter(1, 1)).toBe(false)
    expect(f.peutAjouter(10_000, null)).toBe(true)
  })

  it('dit où en est un compteur', () => {
    expect(f.etatQuota(59, 75)).toBe('ok')
    expect(f.etatQuota(60, 75)).toBe('alerte')
    expect(f.etatQuota(75, 75)).toBe('atteint')
    expect(f.etatQuota(78, 75)).toBe('tolerance')
    expect(f.etatQuota(82, 75)).toBe('bloque')
    expect(f.etatQuota(90, 75)).toBe('bloque')
    // Sans marge (petit plafond) : plein, c'est bloqué.
    expect(f.etatQuota(3, 3)).toBe('bloque')
    expect(f.etatQuota(1, null)).toBe('ok')
  })

  it('désigne la plus petite formule payante pour une taille', () => {
    expect(f.formulePourTaille({ benevoles: 40, artistes: 5 })).toBe('association')
    expect(f.formulePourTaille({ benevoles: 40, artistes: 30 })).toBe('festival')
    expect(f.formulePourTaille({ evenements: 4, benevoles: 50 })).toBe('festival')
    expect(f.formulePourTaille({ benevoles: 600, organisateurs: 15 })).toBe('grand')
    expect(f.formulePourTaille({ benevoles: 5000 })).toBeNull()
  })

  it('désigne la formule supérieure', () => {
    expect(f.formuleSuperieure('decouverte')).toBe('association')
    expect(f.formuleSuperieure('festival')).toBe('grand')
    expect(f.formuleSuperieure('grand')).toBeNull()
  })

  it('propose la formule qui relève vraiment le plafond atteint', () => {
    // Découverte et Association ont 1 événement : pour les événements, c'est Festival.
    expect(f.formuleQuiReleve('decouverte', 'evenements')).toBe('festival')
    expect(f.formuleQuiReleve('decouverte', 'benevoles')).toBe('association')
    expect(f.formuleQuiReleve('festival', 'organisateurs')).toBe('grand')
    expect(f.formuleQuiReleve('grand', 'benevoles')).toBeNull()
    expect(f.formuleQuiReleve('grand', 'organisateurs')).toBeNull()
  })

  it('calcule la fin d’une période facturée', () => {
    const debut = new Date('2026-11-27T10:00:00Z')
    expect(f.finDePeriode(debut, 'monthly').toISOString()).toBe('2026-12-27T10:00:00.000Z')
    expect(f.finDePeriode(debut, 'annual').toISOString()).toBe('2027-11-27T10:00:00.000Z')
  })

  it('écrit les prix à la française', () => {
    expect(f.euros(700)).toBe('7\u00a0€')
    expect(f.euros(1250)).toBe('12,50\u00a0€')
  })

  it('la lecture seule repose sur le contexte asynchrone de Nitro', () => {
    // Sans lui, `useEvent()` lève : toute LECTURE d'un événement archivé serait refusée.
    expect(lire('nuxt.config.ts')).toMatch(/asyncContext:\s*true/)
    expect(lire('server/utils/droits-evenement.ts')).toMatch(/useEvent\(\)\.method/)
  })

  it('les quatre points de contrôle des plafonds sont branchés', () => {
    // Un util écrit et testé mais jamais appelé ne limite rien : on vérifie chaque appel.
    expect(lire('server/api/events/index.post.ts')).toMatch(/verifierNouvelEvenement\(/)
    expect(lire('server/api/events/[id]/organizers/index.post.ts')).toMatch(
      /verifierAjout\(eventId, 'organisateurs'/
    )
    expect(lire('server/volunteers/ports/registry.ts')).toMatch(
      /verifierAjout\(eventId, 'benevoles'/
    )
    expect(lire('server/artists/ports/registry.ts')).toMatch(/verifierAjout\(eventId, 'artistes'/)
    const layers = resolve(APP2, '../../layers')
    const benevoles = (c: string) =>
      readFileSync(resolve(layers, 'volunteers/server/api/editions/[id]/volunteers', c), 'utf8')
    for (const c of [
      'add-manually.post.ts',
      'create-user-and-add.post.ts',
      'applications/[applicationId].patch.ts',
    ]) {
      expect(benevoles(c), c).toMatch(/quotas\?\.verifierAjoutBenevole\(/)
    }
    const artistes = (c: string) =>
      readFileSync(resolve(layers, 'artists/server/api/editions/[id]', c), 'utf8')
    for (const c of [
      'artists/index.post.ts',
      'shows-call/[showCallId]/applications/[applicationId]/import-performer.post.ts',
    ]) {
      expect(artistes(c), c).toMatch(/quotas\?\.verifierAjoutArtiste\(/)
    }
  })
})
