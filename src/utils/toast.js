import Swal from 'sweetalert2'

/**
 * Toasts du back-office, rendus par SweetAlert2.
 *
 * Remplace les `VSnackbar` que chaque page redéclarait avec son trio
 * `snackbar / snackText / snackColor` : sept pages, sept fois le même bloc, et
 * un composant à ne pas oublier dans le template sous peine de notification
 * muette. Ici l'appel suffit, il n'y a rien à monter dans la page.
 *
 * Même bibliothèque et même position que le site public (voir
 * `ticketExpress-frontend/src/utils/toast.ts`), pour qu'une notification ait le
 * même comportement des deux côtés de la plateforme.
 *
 * `src/utils` est auto-importé (voir vite.config.js) : `notify()` est donc
 * disponible dans n'importe quel SFC sans import.
 */
const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timerProgressBar: true,
  customClass: {
    popup: 'te-toast',
    title: 'te-toast__title',
    timerProgressBar: 'te-toast__progress',
  },
  didOpen: element => {
    // Lire un message long ne doit pas courir contre le minuteur.
    element.addEventListener('mouseenter', Swal.stopTimer)
    element.addEventListener('mouseleave', Swal.resumeTimer)
  },
})

/**
 * Les couleurs Vuetify utilisées par les anciens snackbars vers les quatre
 * icônes de SweetAlert. Une couleur inconnue tombe sur « info » plutôt que de
 * lever : une notification ne doit jamais casser l'action qu'elle annonce.
 */
const ICONS = {
  success: 'success',
  error: 'error',
  warning: 'warning',
  info: 'info',
  primary: 'info',
  secondary: 'info',
}

/**
 * Affiche un toast.
 *
 * @param {string} text Message affiché.
 * @param {'success'|'error'|'warning'|'info'} [color] Reprend la couleur que
 *   passaient les snackbars, d'où le nom du paramètre.
 * @param {number} [duration] Durée en ms ; le minuteur se met en pause au survol.
 */
export const notify = (text, color = 'success', duration = 5000) => {
  void Toast.fire({
    icon: ICONS[color] ?? 'info',
    title: text,
    timer: duration,
  })
}

/** Raccourcis pour les deux cas courants. */
export const notifySuccess = (text, duration) => notify(text, 'success', duration)

export const notifyError = (text, duration) => notify(text, 'error', duration)

/**
 * Message d'erreur d'une réponse API, avec repli.
 *
 * `$api` (ofetch) expose le corps sous `data`, `useApi` sous `_data` : les deux
 * sont testés ici pour que les pages n'aient plus à choisir.
 */
export const notifyApiError = (error, fallback = 'Une erreur est survenue.') =>
  notify(error?.data?.message ?? error?._data?.message ?? fallback, 'error')
