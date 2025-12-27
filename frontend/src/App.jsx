import React, { useState } from 'react'
import CreateDeposit from './components/CreateDeposit'
import ReceiverView from './components/ReceiverView'
import AdminDashboard from './components/AdminDashboard'
import './App.css'

function App() {
  const [currentView, setCurrentView] = useState('create')

  return (
    <div className='container'>
      <header style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ color: 'white', fontSize: '2.5rem', marginBottom: '10px' }}>
          Safe Transit
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '1.1rem' }}>
          Secure Deposit Management System
        </p>
      </header>

      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <button
          className={`btn ${currentView === 'create' ? 'active' : ''}`}
          onClick={() => setCurrentView('create')}
          style={{ marginRight: '10px' }}
        >
          Create Deposit
        </button>
        <button
          className={`btn ${currentView === 'receiver' ? 'active' : ''}`}
          onClick={() => setCurrentView('receiver')}
          style={{ marginRight: '10px' }}
        >
          Receiver View
        </button>
        <button
          className={`btn ${currentView === 'admin' ? 'active' : ''}`}
          onClick={() => setCurrentView('admin')}
        >
          Admin Dashboard
        </button>
      </div>

      {currentView === 'create' && <CreateDeposit />}
      {currentView === 'receiver' && <ReceiverView />}
      {currentView === 'admin' && <AdminDashboard />}
    </div>
  )
}

export default App
