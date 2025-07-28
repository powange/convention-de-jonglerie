/**
 * Composable pour formatter les dates avec horaires
 */
export const useDateFormat = () => {
  /**
   * Formate une date avec l'heure
   */
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  /**
   * Formate seulement la date
   */
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  /**
   * Formate une plage de dates avec horaires
   */
  const formatDateTimeRange = (startString: string, endString: string) => {
    const startDate = new Date(startString);
    const endDate = new Date(endString);
    
    // Si même jour
    if (startDate.toDateString() === endDate.toDateString()) {
      return `Le ${startDate.toLocaleDateString('fr-FR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      })} de ${startDate.toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })} à ${endDate.toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })}`;
    }
    
    // Si différents jours
    return `Du ${formatDateTime(startString)} au ${formatDateTime(endString)}`;
  };

  /**
   * Formate une plage de dates sans horaires (pour la compatibilité)
   */
  const formatDateRange = (startString: string, endString: string) => {
    const startDate = new Date(startString);
    const endDate = new Date(endString);
    
    if (startDate.toDateString() === endDate.toDateString()) {
      return formatDate(startString);
    }
    
    return `Du ${formatDate(startString)} au ${formatDate(endString)}`;
  };

  return {
    formatDateTime,
    formatDate,
    formatDateTimeRange,
    formatDateRange
  };
};