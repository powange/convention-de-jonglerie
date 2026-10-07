import { DateTime } from 'luxon'
import { describe, it, expect } from 'vitest'

import { fuseauDImport, messageDeRefusDuFuseau } from '../../../shared/utils/fuseau-depuis-import'

describe('fuseauDImport', () => {
  it('traduit l’abréviation d’heure d’été que l’IA renvoie', () => {
    // Le cas signalé : l'import échouait sur « EDT » alors que c'est le cas SÛR.
    expect(fuseauDImport('EDT')).toEqual({
      ok: true,
      fuseau: 'America/New_York',
      corrige: true,
    })
    expect(fuseauDImport('CEST').fuseau).toBe('Europe/Paris')
    expect(fuseauDImport('AEDT').fuseau).toBe('Australia/Sydney')
  })

  it('accepte la casse telle que l’IA l’écrit', () => {
    expect(fuseauDImport('edt').fuseau).toBe('America/New_York')
  })

  it('laisse passer un fuseau IANA de localité', () => {
    expect(fuseauDImport('Europe/Paris')).toEqual({
      ok: true,
      fuseau: 'Europe/Paris',
      corrige: false,
    })
    expect(fuseauDImport('UTC').fuseau).toBe('UTC')
  })

  it('un fuseau absent reste légitime', () => {
    // Le champ est facultatif : douze éditions sur quarante-trois n'en déclarent pas.
    for (const vide of [null, undefined, '', '   ']) {
      expect(fuseauDImport(vide)).toEqual({ ok: true, fuseau: null, corrige: false })
    }
  })

  describe('⚠️ les abréviations que Luxon ACCEPTAIT, et qui décalaient les dates', () => {
    /*
     * Le cœur du correctif. Ces valeurs passaient la garde d'import et produisaient des instants
     * faux — de 1 h pour « EST » en été à 13 h pour « CST » en Chine. Le test les refuse, et
     * vérifie d'abord que Luxon les tient pour valides : sans cela, il ne prouverait rien, ces
     * valeurs pouvant être refusées pour une tout autre raison.
     */
    const PIEGES = ['EST', 'MST', 'BST', 'IST', 'CST', 'PST', 'CET', 'GMT'] as const

    it.each(PIEGES)('%s est bien valide pour Luxon, et refusée ici', (abreviation) => {
      expect(
        DateTime.local().setZone(abreviation).isValid,
        `${abreviation} n'est plus valide pour Luxon : ce cas ne prouve plus rien`
      ).toBe(true)

      const resultat = fuseauDImport(abreviation)
      expect(resultat.ok).toBe(false)
    })

    it('BST vaut +6 — le Bangladesh, et non British Summer Time', () => {
      // La plus dangereuse : six heures d'écart pour une convention britannique, sans alerte.
      expect(DateTime.fromISO('2026-07-15T12:00', { zone: 'BST' }).offset / 60).toBe(6)
      expect(fuseauDImport('BST').ok).toBe(false)
    })

    it('EST est un décalage FIGÉ : une heure de trop en été', () => {
      const figé = DateTime.fromISO('2026-07-15T12:00', { zone: 'EST' })
      const reel = DateTime.fromISO('2026-07-15T12:00', { zone: 'America/New_York' })
      expect((figé.toMillis() - reel.toMillis()) / 3600000).toBe(1)
      expect(fuseauDImport('EST').ok).toBe(false)
    })
  })

  it('refuse un fuseau de localité qui n’existe pas', () => {
    expect(fuseauDImport('Europe/Atlantide')).toEqual({ ok: false, raison: 'inconnu' })
  })

  it('refuse une valeur qui n’a pas la forme attendue', () => {
    expect(fuseauDImport('Paris').raison).toBe('forme_invalide')
    expect(fuseauDImport('+02:00').raison).toBe('forme_invalide')
  })
})

describe('messageDeRefusDuFuseau', () => {
  it('dit quoi écrire, et non seulement que c’est faux', () => {
    // « Fuseau horaire inconnu » ne disait pas la forme attendue : on ne savait pas quoi corriger.
    for (const valeur of ['IST', 'Paris', 'Europe/Atlantide']) {
      const resultat = fuseauDImport(valeur)
      expect(resultat.ok).toBe(false)
      const message = messageDeRefusDuFuseau(resultat as never)
      expect(message).toContain('Région/Localité')
      expect(message).toMatch(/Europe\/Paris|America\/New_York/)
    }
  })
})
