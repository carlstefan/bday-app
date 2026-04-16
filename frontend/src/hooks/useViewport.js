import { useState, useEffect } from 'react'

export function useViewport() {
  const [size, setSize] = useState({
    width:      window.innerWidth,
    height:     window.innerHeight,
    isPortrait: window.innerHeight > window.innerWidth,
  })

  useEffect(() => {
    const handler = () =>
      setSize({
        width:      window.innerWidth,
        height:     window.innerHeight,
        isPortrait: window.innerHeight > window.innerWidth,
      })

    window.addEventListener('resize', handler)
    window.addEventListener('orientationchange', handler)
    return () => {
      window.removeEventListener('resize', handler)
      window.removeEventListener('orientationchange', handler)
    }
  }, [])

  return size
}
