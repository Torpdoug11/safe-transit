import React, { useState } from 'react'
import CreateDeposit from './components/CreateDeposit'
import ReceiverView from './components/ReceiverView'
import AdminDashboard from './components/AdminDashboard'
import './App.css'

function App() {
  const [currentView, setCurrentView] = useState('create')

  return (
    <div className='container'>
      <header>
        <h1>Safe Transit</h1>
        <p>Secure Deposit Management System</p>
      </header>

      <div className='tab-container'>
        <button
          className={`btn ${currentView === 'create' ? 'active' : ''}`}
          onClick={() => setCurrentView('create')}
        >
          Create Deposit
        </button>
        <button
          className={`btn ${currentView === 'receiver' ? 'active' : ''}`}
          onClick={() => setCurrentView('receiver')}
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
