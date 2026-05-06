import { createContext, useContext, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

const PartyContext = createContext(null)

export function PartyProvider({ children }) {
  const { partyKey } = useParams()
  const [party, setParty]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    if (!partyKey) {
      setParty(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    fetch(`/api/parties/${partyKey}`, { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error(r.status === 404 ? 'Party not found.' : 'Failed to load party.')
        return r.json()
      })
      .then(data => setParty(data.party))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [partyKey])

  return (
    <PartyContext.Provider value={{ party, loading, error, setParty }}>
      {children}
    </PartyContext.Provider>
  )
}

export function useParty() {
  return useContext(PartyContext)
}
