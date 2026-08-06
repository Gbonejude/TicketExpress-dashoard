const DAY_MONTH = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const MONTH_YEAR = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' })

/**
 * L'étiquette française d'un pas de la série des rapports.
 *
 * `2026-08-05` → « 5 août », `2026-08` → « août 2026 ». L'API décide du pas
 * (jour ou mois) selon l'étendue de la période ; le format suit.
 *
 * La date est reconstruite champ par champ plutôt que passée à `new Date(chaîne)` :
 * une chaîne ISO courte est lue comme minuit UTC, ce qui décale l'affichage d'un
 * jour dès que le navigateur est à l'ouest de Greenwich.
 *
 * @param {string} bucket Le `bucket` renvoyé par `reports/overview`.
 *
 * @returns {string}
 */
export const formatBucket = bucket => {
  const parts = String(bucket).split('-').map(Number)

  if (parts.length === 3)
    return DAY_MONTH.format(new Date(parts[0], parts[1] - 1, parts[2]))

  if (parts.length === 2)
    return MONTH_YEAR.format(new Date(parts[0], parts[1] - 1, 1))

  return bucket
}
