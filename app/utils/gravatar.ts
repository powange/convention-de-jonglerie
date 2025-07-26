import md5 from 'md5';

/**
 * Génère l'URL Gravatar pour un email donné
 * @param email - L'adresse email de l'utilisateur
 * @param size - La taille de l'avatar (défaut: 80)
 * @param defaultImage - Image par défaut si pas de Gravatar (défaut: 'mp' pour mystery person)
 * @returns URL complète vers l'avatar Gravatar
 */
export function getGravatarUrl(email: string, size: number = 80, defaultImage: string = 'mp'): string {
  if (!email) return '';
  
  // Normaliser l'email (minuscules et supprimer les espaces)
  const normalizedEmail = email.toLowerCase().trim();
  
  // Créer le hash MD5 de l'email
  const hash = md5(normalizedEmail);
  
  // Construire l'URL Gravatar
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=${defaultImage}`;
}

/**
 * Composable pour utiliser Gravatar dans les composants Vue
 */
export function useGravatar() {
  const getUserAvatar = (email: string, size: number = 80) => {
    return getGravatarUrl(email, size, 'mp');
  };

  return {
    getUserAvatar
  };
}