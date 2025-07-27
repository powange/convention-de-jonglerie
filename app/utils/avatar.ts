import { useGravatar } from './gravatar';

export const useAvatar = () => {
  const { getUserAvatar: getGravatarAvatar } = useGravatar();

  const getUserAvatar = (user: { email?: string; emailHash?: string; profilePicture?: string | null; updatedAt?: string }, size: number = 80) => {
    // Vérification de sécurité
    if (!user || (!user.email && !user.emailHash)) {
      return 'https://www.gravatar.com/avatar/default?s=80&d=mp'; // URL de fallback
    }
    
    // Si l'utilisateur a une photo de profil, l'utiliser avec cache-busting
    if (user.profilePicture) {
      // Utiliser updatedAt comme version pour éviter le cache, sinon timestamp actuel
      const version = user.updatedAt ? new Date(user.updatedAt).getTime() : Date.now();
      
      // Construire l'URL complète si c'est un chemin relatif
      let profileUrl = user.profilePicture;
      if (profileUrl.startsWith('/')) {
        // Si on est côté client, utiliser l'origine actuelle
        if (import.meta.client) {
          profileUrl = `${window.location.origin}${profileUrl}`;
        }
      }
      
      return `${profileUrl}?v=${version}`;
    }
    
    // Sinon, utiliser Gravatar
    if (user.emailHash) {
      // Utiliser directement le hash MD5 fourni (pour les autres utilisateurs)
      return `https://www.gravatar.com/avatar/${user.emailHash}?s=${size}&d=mp`;
    } else if (user.email) {
      // Calculer le hash MD5 depuis l'email (pour l'utilisateur connecté)
      return getGravatarAvatar(user.email, size);
    }
    
    return 'https://www.gravatar.com/avatar/default?s=80&d=mp';
  };

  return {
    getUserAvatar,
  };
};