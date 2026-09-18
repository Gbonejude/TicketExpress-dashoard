<script setup>
import { $api } from '@/utils/api'

const router = useRouter()

// Notifications are scoped to the current user by the backend
// (`$request->user()->notifications()`), so an organizer only ever sees their
// own notifications here.
const notifications = ref([])

const typeColor = type => ({
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error',
}[type] ?? 'primary')

const formatTime = iso => {
  if (!iso) return ''

  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''

  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const mapNotification = n => ({
  id: n.id,
  title: n.data?.title ?? 'Notification',
  subtitle: n.data?.message ?? '',
  time: formatTime(n.created_at),
  isSeen: !!n.read_at,
  color: typeColor(n.data?.type),
  icon: 'tabler-bell',
  data: n.data ?? {},
})

const fetchNotifications = async () => {
  const accessToken = useCookie('accessToken')
  if (!accessToken.value) return

  try {
    const res = await $api('/notifications')
    const list = Array.isArray(res?.data) ? res.data : []
    notifications.value = list.map(mapNotification)
  } catch {
    // silent — the bell just stays empty
  }
}

onMounted(fetchNotifications)

const markRead = async notificationIds => {
  await Promise.all(notificationIds.map(async id => {
    try {
      await $api(`/notifications/${id}/markasread`, { method: 'POST' })
    } catch {
      // ignore individual failures
    }
  }))
  notifications.value.forEach(item => {
    if (notificationIds.includes(item.id))
      item.isSeen = true
  })
}

// The backend only exposes "mark as read"; unread is a local-only toggle.
const markUnRead = notificationIds => {
  notifications.value.forEach(item => {
    if (notificationIds.includes(item.id))
      item.isSeen = false
  })
}

const removeNotification = async notificationId => {
  try {
    await $api(`/notifications/${notificationId}`, { method: 'DELETE' })
  } catch {
    // organizers can't delete server-side — just dismiss locally
  }
  notifications.value = notifications.value.filter(item => item.id !== notificationId)
}

const resolveTargetRoute = data => {
  if (!data) return null

  const orderId = data.order_id ?? data.orderId ?? data.order?.id
  if (orderId) return `/orders/${orderId}`

  const orderNumber = data.order_number ?? data.orderNumber ?? data.order?.order_number
  if (orderNumber) return { path: '/orders', query: { search: orderNumber } }

  if (data.withdrawal_id || data.withdrawalId || data.action === 'view_withdrawal')
    return '/withdrawals'

  if (data.action === 'view_organizer' || data.organizer_id) {
    return {
      path: '/organizers',
      query: {
        ...(data.company_name ? { search: data.company_name } : {}),
        status: 'pending',
      },
    }
  }

  if (data.action === 'view_event' && data.event_id)
    return `/events/${data.event_id}`

  if (data.url) {
    const cleanUrl = data.url.replace(/^\/(?:admin|organizer)(?=\/|$)/, '')

    if (!cleanUrl || cleanUrl === '/')
      return '/dashboard'

    if (cleanUrl.startsWith('/organizers')) {
      return {
        path: '/organizers',
        query: {
          ...(data.company_name ? { search: data.company_name } : {}),
          status: 'pending',
        },
      }
    }

    try {
      const resolved = router.resolve(cleanUrl)
      if (resolved?.matched?.length > 0)
        return cleanUrl
    } catch {
      // ignore
    }

    return '/dashboard'
  }

  return null
}

const handleNotificationClick = notification => {
  if (!notification.isSeen)
    markRead([notification.id])

  const target = resolveTargetRoute(notification.data ?? {})
  if (target)
    void router.push(target)
}
</script>

<template>
  <Notifications
    :notifications="notifications"
    @remove="removeNotification"
    @read="markRead"
    @unread="markUnRead"
    @click:notification="handleNotificationClick"
  />
</template>
