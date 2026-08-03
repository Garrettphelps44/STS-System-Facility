import { useEffect } from 'react'
import { supabase } from './lib/supabase'

function App() {
  useEffect(() => {
    console.log('Supabase client ready:', supabase)
  }, [])

  return <div />
}

export default App
