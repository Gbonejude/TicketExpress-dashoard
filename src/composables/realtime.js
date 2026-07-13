import { onBeforeUnmount } from 'vue'
import { useEventBus } from '@vueuse/core'
import { getEcho } from './useEcho'

// Public Pusher channels the back-office listens to. The payload is a
// lightweight signal ({ action, id, label }); pages re-fetch via the API.
const CHANNELS = ['organizers', 'events', 'orders', 'tickets', 'payments']

// Changes on these channels also raise a global toast (visible on any page).
const TOAST_CHANNELS = ['organizers', 'events']

let started = false

/**
 * Subscribe once to every back-office channel. For each change we emit on a
 * per-channel event bus (list pages listen) and, for organizers/events, call
 * onNotify so a global toast can be shown.
 */
export const setupRealtime = onNotify => {
  if (started)
    return

  const echo = getEcho()
  const pusher = echo?.connector?.pusher
  if (!pusher)
    return

  started = true

  // Bind directly on the raw Pusher channels (reliable for every channel,
  // unlike Echo's .listen() which dropped the first channel's handler here).
  CHANNELS.forEach(channelName => {
    pusher.subscribe(channelName).bind('changed', payload => {
      useEventBus(`realtime:${channelName}`).emit(payload)

      if (TOAST_CHANNELS.includes(channelName) && onNotify)
        onNotify(channelName, payload)
    })
  })
}

/**
 * List pages use this to re-fetch when their channel signals a change.
 */
export const useRealtimeRefresh = (channel, onChange) => {
  const bus = useEventBus(`realtime:${channel}`)
  const stop = bus.on(payload => onChange(payload))

  onBeforeUnmount(stop)
}
