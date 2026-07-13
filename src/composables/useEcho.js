import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

let echoInstance = null

/**
 * Lazily create a singleton Laravel Echo instance backed by Pusher.
 * Returns null if no Pusher key is configured (real-time simply disabled).
 */
export const getEcho = () => {
  if (echoInstance)
    return echoInstance

  const key = import.meta.env.VITE_PUSHER_APP_KEY
  const cluster = import.meta.env.VITE_PUSHER_APP_CLUSTER || 'mt1'

  if (!key)
    return null

  try {
    window.Pusher = Pusher

    echoInstance = new Echo({
      broadcaster: 'pusher',
      key,
      cluster,
      forceTLS: true,
      enabledTransports: ['ws', 'wss'],
    })
  } catch (err) {
    console.error('[realtime] Echo init failed:', err)

    return null
  }

  return echoInstance
}
