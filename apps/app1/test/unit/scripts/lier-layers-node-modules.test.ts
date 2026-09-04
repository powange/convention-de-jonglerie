import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, lstatSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// @ts-expect-error — module .mjs sans déclarations, importé pour son comportement
import { lierLayers } from '../../../scripts/lier-layers-node-modules.mjs'

/**
 * Le lien rétablit la résolution des paquets depuis `layers/`, sans quoi le compilateur y dégrade
 * tous les types en `any` — 97 modules introuvables au dernier comptage. Le script s'exécute à
 * chaque installation : il doit donc être sans surprise, et surtout ne jamais écraser ce qu'il
 * trouve.
 */
describe('Liaison des dépendances pour les layers', () => {
  let base: string
  let layers: string
  let cible: string
  const silence = { log: () => {}, warn: () => {} }

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'layers-'))
    layers = join(base, 'layers')
    cible = join(base, 'app', 'node_modules')
    mkdirSync(layers)
    mkdirSync(cible, { recursive: true })
  })

  afterEach(() => rmSync(base, { recursive: true, force: true }))

  it('crée le lien quand il manque', () => {
    expect(lierLayers(layers, cible, silence)).toBe('cree')
    expect(existsSync(join(layers, 'node_modules'))).toBe(true)
    expect(lstatSync(join(layers, 'node_modules')).isSymbolicLink()).toBe(true)
  })

  it('ne fait rien si le lien est déjà en place', () => {
    lierLayers(layers, cible, silence)
    expect(lierLayers(layers, cible, silence)).toBe('deja-lie')
  })

  it('n’écrase pas un vrai dossier de dépendances', () => {
    // Le jour où un layer aurait ses propres dépendances, les remplacer par un lien les perdrait.
    mkdirSync(join(layers, 'node_modules'))
    expect(lierLayers(layers, cible, silence)).toBe('dossier-reel')
    expect(lstatSync(join(layers, 'node_modules')).isSymbolicLink()).toBe(false)
  })

  it('n’écrase pas un lien pointant ailleurs', () => {
    const autre = join(base, 'autre')
    mkdirSync(autre)
    symlinkSync(autre, join(layers, 'node_modules'), 'junction')
    expect(lierLayers(layers, cible, silence)).toBe('lien-etranger')
  })

  it('ne fait rien, sans échouer, si les layers n’existent pas', () => {
    // C'est le cas d'une app installée seule, hors du dépôt : l'installation ne doit pas casser.
    expect(lierLayers(join(base, 'inexistant'), cible, silence)).toBe('absent')
  })
})
