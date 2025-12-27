import React, { useState } from 'react'
import { api } from '../services/api'

function CreateDeposit() {
  const [formData, setFormData] = useState({
    amount: '',
    requirement: '',
    time_limit: '',
    creator_id: '',
    receiver_id: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [createdDeposit, setCreatedDeposit] = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    setError('')
    setSuccess('')
  }

  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // Validate form data
      if (!formData.amount || !formData.requirement || !formData.time_limit) {
        throw new Error('Please fill in all required fields')
      }

      if (parseFloat(formData.amount) <= 0) {
        throw new Error('Amount must be greater than 0')
      }

      const timeLimitDate = new Date(formData.time_limit)
      if (timeLimitDate <= new Date()) {
        throw new Error('Time limit must be in the future')
      }

      // Generate UUIDs for creator and receiver if not provided
      const depositData = {
        ...formData,
        amount: parseFloat(formData.amount),
        time_limit: timeLimitDate.toISOString(),
        creator_id: formData.creator_id || generateUUID(),
        receiver_id: formData.receiver_id || generateUUID()
      }

      const result = await api.createDeposit(depositData)
      setCreatedDeposit(result.deposit)
      setSuccess('Deposit created successfully!')
      
      // Reset form
      setFormData({
        amount: '',
        requirement: '',
        time_limit: '',
        creator_id: '',
        receiver_id: ''
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='card'>
      <h2 style={{ marginBottom: '30px', color: '#2d3748' }}>Create New Deposit</h2>
      
      {error && <div className='error'>{error}</div>}
      {success && <div className='success'>{success}</div>}

      <form onSubmit={handleSubmit}>
        <div className='form-group'>
          <label htmlFor='amount'>Amount ($)*</label>
          <input
            type='number'
            id='amount'
            name='amount'
            value={formData.amount}
            onChange={handleChange}
            step='0.01'
            min='0.01'
            placeholder='Enter amount'
            required
          />
        </div>

        <div className='form-group'>
          <label htmlFor='requirement'>Requirement*</label>
          <textarea
            id='requirement'
            name='requirement'
            value={formData.requirement}
            onChange={handleChange}
            placeholder='Describe the requirements for this deposit'
            rows='4'
            required
          />
        </div>

        <div className='form-group'>
          <label htmlFor='time_limit'>Time Limit*</label>
          <input
            type='datetime-local'
            id='time_limit'
            name='time_limit'
            value={formData.time_limit}
            onChange={handleChange}
            min={new Date().toISOString().slice(0, 16)}
            required
          />
        </div>

        <div className='form-group'>
          <label htmlFor='creator_id'>Creator ID (Optional)</label>
          <input
            type='text'
            id='creator_id'
            name='creator_id'
            value={formData.creator_id}
            onChange={handleChange}
            placeholder='Will be auto-generated if empty'
          />
        </div>

        <div className='form-group'>
          <label htmlFor='receiver_id'>Receiver ID (Optional)</label>
          <input
            type='text'
            id='receiver_id'
            name='receiver_id'
            value={formData.receiver_id}
            onChange={handleChange}
            placeholder='Will be auto-generated if empty'
          />
        </div>

        <button type='submit' className='btn' disabled={loading}>
          {loading ? 'Creating...' : 'Create Deposit'}
        </button>
      </form>

      {createdDeposit && (
        <div style={{ marginTop: '30px' }}>
          <h3 style={{ color: '#2d3748', marginBottom: '15px' }}>Deposit Created Successfully!</h3>
          <div className='deposit-id'>
            <strong>Deposit ID:</strong><br />
            {createdDeposit.id}
          </div>
          <p style={{ textAlign: 'center', marginTop: '15px', color: '#718096' }}>
            Save this ID to track your deposit status
          </p>
        </div>
      )}
    </div>
  )
}

export default CreateDeposit
