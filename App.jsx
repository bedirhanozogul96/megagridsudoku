import MegaGridSudoku from './MegaGridSudoku'

function App() {
  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      backgroundColor: '#121212',
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      margin: 0, 
      padding: 0 
    }}>
      
      <div style={{
        /* Dikey 16, Yatay 9 Oranı */
        aspectRatio: '9 / 16',
        
        /* Ekrana sığması için maksimum yükseklik (%95) */
        maxHeight: '95vh',
        height: '100%',
        
        backgroundColor: '#000000',
        overflow: 'hidden', 
        boxShadow: '0 0 40px rgba(0, 0, 0, 0.9)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <MegaGridSudoku />
      </div>
      
    </div>
  )
}

export default App