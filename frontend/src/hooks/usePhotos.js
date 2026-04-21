import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client.js'

export function usePhotos(url = '/api/photos?limit=500') {
  const [photos, setPhotos]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const fetchPhotos = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.get(url)
      setPhotos(data.photos)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [url])

  useEffect(() => {
    fetchPhotos()
  }, [fetchPhotos])

  return { photos, loading, error, setPhotos, refetch: fetchPhotos }
}
