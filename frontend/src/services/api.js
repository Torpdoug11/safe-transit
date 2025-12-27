const API_BASE_URL = 'http://localhost:3000'

export const api = {
  async createDeposit(depositData) {
    try {
      const response = await fetch(${API_BASE_URL}/deposit, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(depositData),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create deposit')
      }
      
      return await response.json()
    } catch (error) {
      console.error('API Error:', error)
      throw error
    }
  },

  async getDeposit(id) {
    try {
      const response = await fetch(${API_BASE_URL}/deposit/)
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Deposit not found')
      }
      
      return await response.json()
    } catch (error) {
      console.error('API Error:', error)
      throw error
    }
  },

  async fulfillDeposit(id) {
    try {
      const response = await fetch(${API_BASE_URL}/deposit//fulfill, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fulfill deposit')
      }
      
      return await response.json()
    } catch (error) {
      console.error('API Error:', error)
      throw error
    }
  }
}
