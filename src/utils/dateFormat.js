/**
 * Formate un objet date Laravel en format français
 * @param {Object} dateObj - Objet avec propriété datetime (format: YYYY-MM-DD HH:MM:SS)
 * @returns {string} Date formatée en français (ex: "Dim, 23 août 2026 19:00")
 */
export const formatDateFr = (dateObj) => {
  if (!dateObj?.datetime) return '-'
  
  const date = new Date(dateObj.datetime)
  const options = {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }
  
  return date.toLocaleDateString('fr-FR', options)
    .replace(/^(\w)/, (c) => c.toUpperCase())
}

/**
 * Formate un objet date Laravel en format français court (sans heure)
 * @param {Object} dateObj - Objet avec propriété datetime
 * @returns {string} Date formatée (ex: "23 août 2026")
 */
export const formatDateShortFr = (dateObj) => {
  if (!dateObj?.datetime) return '-'
  
  const date = new Date(dateObj.datetime)
  const options = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }
  
  return date.toLocaleDateString('fr-FR', options)
}
