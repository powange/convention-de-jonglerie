import { z } from 'zod'

import {
  CONVENTION_RIGHTS,
  EDITION_RIGHTS,
  type ConventionRight,
  type EditionRight,
} from '../../../shared/utils/organizer-rights'

/**
 * Formes dérivées des droits d'organisateur.
 *
 * Les endpoints énuméraient ces champs à la main — schémas de validation, sélections Prisma,
 * correspondances de sortie. Un droit oublié dans l'un d'eux se cochait dans le formulaire,
 * semblait s'enregistrer, et se retrouvait décoché au retour : la validation le rejetait sans
 * erreur. C'est arrivé à la trésorerie, sur quatre fichiers à la fois.
 *
 * Ces formes se construisent désormais depuis `shared/utils/organizer-rights`, seule liste à
 * tenir à jour. Le guide, le menu et le tableau de bord restent écrits à la main : chacun demande
 * un libellé, une icône ou une route qu'aucune génération ne devinera. Un test vérifie qu'ils ne
 * dérivent pas.
 */

/** Un booléen optionnel par droit d'édition, pour un objet Zod. */
export function editionRightsZodShape() {
  return Object.fromEntries(
    EDITION_RIGHTS.map((right) => [right, z.boolean().optional()])
  ) as Record<EditionRight, z.ZodOptional<z.ZodBoolean>>
}

/** Un booléen optionnel par droit de convention, en clés courtes. */
export function conventionRightsZodShape() {
  return Object.fromEntries(
    CONVENTION_RIGHTS.map((right) => [right, z.boolean().optional()])
  ) as Record<ConventionRight, z.ZodOptional<z.ZodBoolean>>
}

/** Sélection Prisma couvrant tous les droits d'édition. */
export const editionRightsSelect = Object.fromEntries(
  EDITION_RIGHTS.map((right) => [right, true])
) as Record<EditionRight, true>

/** Sélection Prisma couvrant tous les droits de convention, préfixés `can`. */
export const conventionRightsSelect = Object.fromEntries(
  CONVENTION_RIGHTS.map((right) => [toCanField(right), true])
) as Record<string, true>

/** `manageFAQ` → `canManageFAQ`. Le schéma préfixe, les clés courtes non. */
export function toCanField(right: ConventionRight): string {
  return `can${right.charAt(0).toUpperCase()}${right.slice(1)}`
}

/** Recopie les droits d'édition d'une source, en ignorant tout le reste. */
export function pickEditionRights(
  source: Record<string, unknown> | null | undefined
): Partial<Record<EditionRight, boolean>> {
  const out: Partial<Record<EditionRight, boolean>> = {}
  for (const right of EDITION_RIGHTS) {
    if (source && typeof source[right] === 'boolean') out[right] = source[right] as boolean
  }
  return out
}

/** Idem, en forçant un booléen — pour les réponses d'API où `undefined` n'a pas de sens. */
export function readEditionRights(
  source: Record<string, unknown> | null | undefined
): Record<EditionRight, boolean> {
  return Object.fromEntries(EDITION_RIGHTS.map((right) => [right, !!source?.[right]])) as Record<
    EditionRight,
    boolean
  >
}

/**
 * Recopie dans `target` les droits de convention fournis, en préfixant les clés de `can`.
 *
 * Seuls les droits explicitement présents sont écrits : `undefined` veut dire « non fourni », et
 * le confondre avec `false` retirerait un droit que personne n'a demandé à retirer.
 */
export function applyConventionRights(
  target: Record<string, boolean>,
  rights: Record<string, boolean | undefined> | null | undefined
): void {
  for (const right of CONVENTION_RIGHTS) {
    const value = rights?.[right]
    if (value !== undefined) target[toCanField(right)] = value
  }
}

/** Vrai dès qu'un droit métier est accordé, quel qu'il soit. */
export function hasAnyEditionRight(source: Record<string, unknown> | null | undefined): boolean {
  return EDITION_RIGHTS.some((right) => !!source?.[right])
}
