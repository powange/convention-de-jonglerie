import type { Edition, Convention } from '~/types';

/**
 * Retourne le nom à afficher pour une édition.
 * Si l'édition n'a pas de nom, retourne le nom de la convention.
 */
export function getEditionDisplayName(edition: { name?: string | null; convention?: { name: string } }): string {
  return edition.name || edition.convention?.name || 'Édition sans nom';
}

/**
 * Retourne le nom à afficher pour une édition avec convention séparée.
 */
export function getEditionDisplayNameWithConvention(edition: { name?: string | null }, convention?: { name: string }): string {
  return edition.name || convention?.name || 'Édition sans nom';
}