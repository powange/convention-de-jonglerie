/**
 * Composable pour formatter les dates avec horaires
 */
export const useDateFormat = () => {
  const { locale, t } = useI18n();

  /**
   * Formate une date avec l'heure
   */
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString(locale.value, {
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
    return date.toLocaleDateString(locale.value, {
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
      return t('dates.same_day_with_time', {
        date: startDate.toLocaleDateString(locale.value, { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric' 
        }),
        startTime: startDate.toLocaleTimeString(locale.value, { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        endTime: endDate.toLocaleTimeString(locale.value, { 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      });
    }
    
    // Si différents jours
    return t('dates.date_range_with_time', {
      startDate: formatDateTime(startString),
      endDate: formatDateTime(endString)
    });
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
    
    return t('dates.date_range', {
      startDate: formatDate(startString),
      endDate: formatDate(endString)
    });
  };

  return {
    formatDateTime,
    formatDate,
    formatDateTimeRange,
    formatDateRange
  };
};