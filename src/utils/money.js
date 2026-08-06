/**
 * Un montant en francs CFA, à la française : « 746 750 FCFA ».
 *
 * Arrondi à l'unité — le franc CFA n'a pas de subdivision en circulation, et
 * afficher des centimes sur un écran d'argent laisse croire à une précision qui
 * n'existe pas.
 *
 * @param {number|string|null|undefined} value
 *
 * @returns {string}
 */
export const formatPrice = value =>
  `${new Intl.NumberFormat('fr-FR').format(Math.round(Number(value ?? 0)))} FCFA`
