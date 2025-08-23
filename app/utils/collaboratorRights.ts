// Utilitaires pour dériver une étiquette/couleur depuis un objet de droits collaborateur
// Heuristique: "admin" si tous les droits globaux principaux sont vrais, "moderator" (staff) si au moins un droit clé, sinon "viewer".

export interface CollaboratorRightsSummary {
  level: 'admin' | 'moderator' | 'viewer';
  labelKey: string; // clé i18n
  color: 'warning' | 'info' | 'neutral';
}

const globalKeys = [
  'editConvention',
  'deleteConvention',
  'manageCollaborators',
  'addEdition',
  'editAllEditions',
  'deleteAllEditions'
] as const;

export function summarizeRights(rights: Record<string, any> | undefined | null): CollaboratorRightsSummary {
  if (!rights) {
    return { level: 'viewer', labelKey: 'permissions.viewer', color: 'neutral' };
  }
  const present = (k: string) => rights[k] === true;
  const all = globalKeys.every(k => present(k));
  if (all) {
    return { level: 'admin', labelKey: 'permissions.admin', color: 'warning' };
  }
  const any = globalKeys.some(k => present(k));
  if (any) {
    return { level: 'moderator', labelKey: 'permissions.moderator', color: 'info' };
  }
  return { level: 'viewer', labelKey: 'permissions.viewer', color: 'neutral' };
}

// Fonction pratique utilisée quand on garde encore l'ancien champ role côté backend pour compat.
export function summarizeFromLegacy(role: string | undefined | null, rights: Record<string, any> | undefined | null): CollaboratorRightsSummary {
  if (role === 'ADMINISTRATOR') return { level: 'admin', labelKey: 'permissions.admin', color: 'warning' };
  if (role === 'MODERATOR') return { level: 'moderator', labelKey: 'permissions.moderator', color: 'info' };
  return summarizeRights(rights);
}
