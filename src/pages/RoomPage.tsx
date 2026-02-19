import { useParams, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Room } from '@/components/Room'

export const RoomPage = () => {
  const { id } = useParams<{ id: string }>()
  const { user, loading } = useAuth()

  if (loading) return null

  if (!user) return <Navigate to="/login" replace />
  if (!id) return <Navigate to="/dashboard" replace />

  return (
    <Room
      roomId={id}
      userId={user.id}
      username={user.email?.split('@')[0] || user.id.slice(0, 8)}
    />
  )
}
