/**
 * Composable pour gérer le statut des éditions
 */
export const useEditionStatus = () => {
  /**
   * Détermine la couleur du badge selon l'état de l'édition
   */
  const getStatusColor = (edition: any): string => {
    const now = new Date();
    const startDate = new Date(edition.startDate);
    const endDate = new Date(edition.endDate);

    if (now < startDate) return 'info';     // À venir - bleu
    if (now > endDate) return 'neutral';    // Terminée - gris
    return 'success';                       // En cours - vert
  };

  /**
   * Détermine le texte du statut selon l'état de l'édition
   */
  const getStatusText = (edition: any): string => {
    const now = new Date();
    const startDate = new Date(edition.startDate);
    const endDate = new Date(edition.endDate);

    if (now < startDate) return 'À venir';
    if (now > endDate) return 'Terminée';
    return 'En cours';
  };

  /**
   * Détermine si une édition est en cours
   */
  const isEditionActive = (edition: any): boolean => {
    const now = new Date();
    const startDate = new Date(edition.startDate);
    const endDate = new Date(edition.endDate);

    return now >= startDate && now <= endDate;
  };

  /**
   * Détermine si une édition est à venir
   */
  const isEditionUpcoming = (edition: any): boolean => {
    const now = new Date();
    const startDate = new Date(edition.startDate);

    return now < startDate;
  };

  /**
   * Détermine si une édition est terminée
   */
  const isEditionFinished = (edition: any): boolean => {
    const now = new Date();
    const endDate = new Date(edition.endDate);

    return now > endDate;
  };

  return {
    getStatusColor,
    getStatusText,
    isEditionActive,
    isEditionUpcoming,
    isEditionFinished
  };
};