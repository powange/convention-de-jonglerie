import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import {
  inscrireLaBalle,
  resoudreLesChocs,
  retirerLaBalle,
  viderLeRegistrePourLesTests,
} from '../../../app/composables/useBallesEnScene'

/**
 * Les chocs entre les balles de l'easter egg.
 *
 * Mesurés ici plutôt que dans un navigateur : ce sont quelques lignes d'arithmétique, et un
 * parcours Playwright ne dirait ni de combien une balle a été repoussée, ni laquelle des deux a
 * pris la paire en charge. Il dirait seulement que « ça a l'air de marcher ».
 */
const TAILLE = 56

function poser(x: number, y: number, options: { vx?: number; vy?: number; tenue?: boolean } = {}) {
  const reveiller = vi.fn()
  const balle = inscrireLaBalle({
    x: ref(x),
    y: ref(y),
    vx: ref(options.vx ?? 0),
    vy: ref(options.vy ?? 0),
    taille: TAILLE,
    tenue: ref(options.tenue ?? false),
    reveiller,
  })
  return { ...balle, reveiller }
}

const ecart = (a: { x: { value: number }; y: { value: number } }, b: typeof a) =>
  Math.hypot(a.x.value - b.x.value, a.y.value - b.y.value)

beforeEach(() => {
  viderLeRegistrePourLesTests()
})

describe('resoudreLesChocs', () => {
  it('ne touche à rien quand les balles ne se touchent pas', () => {
    const a = poser(0, 0, { vx: 300 })
    poser(200, 0)

    resoudreLesChocs(a, 0.2)

    expect(a.x.value).toBe(0)
    expect(a.vx.value).toBe(300)
  })

  it('sépare deux balles imbriquées, chacune pour moitié', () => {
    const a = poser(0, 0)
    const b = poser(30, 0) // 30 px d'entraxe pour 56 de contact : 26 px de chevauchement.

    resoudreLesChocs(a, 0.2)

    expect(ecart(a, b)).toBeCloseTo(TAILLE, 5)
    // À masses égales, chacune a reculé d'autant : le milieu de la paire n'a pas bougé.
    expect(a.x.value + b.x.value).toBeCloseTo(30, 5)
  })

  // Le rebond demandé est FAIBLE : la vitesse restituée doit rester une fraction de l'approche.
  it('restitue une faible part de la vitesse d’approche', () => {
    const a = poser(0, 0, { vx: 100 })
    const b = poser(50, 0)

    resoudreLesChocs(a, 0.2)

    // Approche de 100 px/s, rebond 0,2 : impulsion de 120, partagée en deux.
    expect(a.vx.value).toBeCloseTo(40, 5)
    expect(b.vx.value).toBeCloseTo(60, 5)
    // Et elles s'éloignent bel et bien l'une de l'autre.
    expect(b.vx.value).toBeGreaterThan(a.vx.value)
  })

  it('laisse passer deux balles qui s’éloignent déjà', () => {
    const a = poser(0, 0, { vx: -100 })
    const b = poser(50, 0, { vx: 100 })

    resoudreLesChocs(a, 0.2)

    // Les positions sont corrigées, mais aucune impulsion n'est ajoutée : sans ce garde-fou, deux
    // balles qui se croisent se verraient repoussées une seconde fois et se mettraient à vibrer.
    expect(a.vx.value).toBeCloseTo(-100, 5)
    expect(b.vx.value).toBeCloseTo(100, 5)
  })

  it('ne traite la paire qu’une fois, depuis la plus petite', () => {
    const a = poser(0, 0, { vx: 100 })
    const b = poser(50, 0)

    // La plus grande ne doit rien faire : résolue deux fois, l'impulsion serait doublée.
    resoudreLesChocs(b, 0.2)

    expect(a.vx.value).toBe(100)
    expect(b.vx.value).toBe(0)
  })

  /*
   * LE cas qui a motivé la réécriture. Une balle tenue à la souris ne simule rien et ses voisines
   * au repos dorment : avec la seule règle des identifiants, personne ne résolvait la paire et
   * l'on enfonçait une balle dans une autre à la main.
   */
  it('laisse une balle tenue pousser sa voisine, sans céder elle-même', () => {
    const tenue = poser(0, 0, { tenue: true })
    const libre = poser(30, 0)

    resoudreLesChocs(tenue, 0.2)

    expect(tenue.x.value).toBe(0) // Le geste dicte sa position : elle ne recule pas.
    expect(libre.x.value).toBeCloseTo(TAILLE, 5) // La libre encaisse tout l'écart.
    expect(ecart(tenue, libre)).toBeCloseTo(TAILLE, 5)
  })

  /*
   * Celui-ci dit l'autre moitié de la règle, et c'est elle qui rend le reste cohérent : la balle
   * LIBRE laisse la paire à la balle tenue, quels que soient leurs identifiants. C'est sans risque
   * précisément parce que la boucle d'une balle tenue ne s'endort jamais — elle passera donc.
   */
  it('laisse une balle libre céder la paire à la balle tenue', () => {
    const libre = poser(0, 0)
    const tenue = poser(30, 0, { tenue: true })

    resoudreLesChocs(libre, 0.2)

    expect(libre.x.value).toBe(0)
    expect(tenue.x.value).toBe(30)
  })

  // Et le cas que la seule règle des identifiants manquait : la balle tenue porte le PLUS GRAND.
  it('fait céder la libre même quand la balle tenue a le plus grand identifiant', () => {
    const libre = poser(0, 0)
    const tenue = poser(30, 0, { tenue: true })
    expect(tenue.id).toBeGreaterThan(libre.id)

    resoudreLesChocs(tenue, 0.2)

    expect(tenue.x.value).toBe(30)
    expect(libre.x.value).toBeCloseTo(30 - TAILLE, 5)
  })

  it('ne résout rien entre deux balles tenues à deux doigts', () => {
    const a = poser(0, 0, { tenue: true })
    const b = poser(30, 0, { tenue: true })

    resoudreLesChocs(a, 0.2)

    expect(a.x.value).toBe(0)
    expect(b.x.value).toBe(30)
  })

  /*
   * Une balle au repos a ARRÊTÉ sa boucle. La déplacer sans la réveiller la laisserait suspendue
   * en l'air, la gravité ne s'appliquant plus jamais — un défaut visible et définitif.
   */
  it('réveille la balle qu’elle déplace, même sans lui transmettre de vitesse', () => {
    const a = poser(0, 0)
    const b = poser(30, 0)

    resoudreLesChocs(a, 0.2)

    expect(b.reveiller).toHaveBeenCalled()
  })

  // Le cas réel du geste : on pousse à la main une voisine qui dormait au sol.
  it('réveille la voisine qu’une balle tenue pousse', () => {
    const tenue = poser(0, 0, { tenue: true })
    const libre = poser(30, 0)

    resoudreLesChocs(tenue, 0.2)

    expect(libre.reveiller).toHaveBeenCalled()
  })

  /*
   * Deux balles exactement superposées n'ont pas de direction de séparation. Sans le cas
   * particulier, la division par zéro produit des `NaN` qui se propagent dans les positions : les
   * balles disparaissent pour de bon, et aucune erreur ne le signale.
   */
  it('sépare verticalement deux balles exactement superposées, sans NaN', () => {
    const a = poser(100, 100)
    const b = poser(100, 100)

    resoudreLesChocs(a, 0.2)

    expect(Number.isNaN(a.y.value)).toBe(false)
    expect(Number.isNaN(b.y.value)).toBe(false)
    expect(ecart(a, b)).toBeCloseTo(TAILLE, 5)
  })

  it('ignore une balle démontée', () => {
    const a = poser(0, 0, { vx: 100 })
    const b = poser(30, 0)
    retirerLaBalle(b.id)

    resoudreLesChocs(a, 0.2)

    expect(a.x.value).toBe(0)
    expect(b.x.value).toBe(30)
  })
})
