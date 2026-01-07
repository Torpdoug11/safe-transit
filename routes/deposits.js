const express = require('express');
const router = express.Router();
const Deposit = require('../models/Deposit');
const validator = require('validator');
const { sanitizeInput, depositValidation, handleValidationErrors } = require('../middleware/validation');

// In-memory storage for deposits (in production, use a database)
const deposits = new Map();

// Auto-expiration logic: Check and update expired deposits every minute
setInterval(() => {
  const now = new Date();
  for (const [id, deposit] of deposits.entries()) {
    if (deposit.status === 'created' && new Date(deposit.time_limit) < now) {
      deposit.updateStatus('expired');
      deposits.set(id, deposit);
      console.log(`Auto-expired deposit ${id}`);
    }
  }
}, 60000); // Run every minute

// Function to check expiration for a specific deposit
function checkExpiration(deposit) {
  if (deposit.status === 'created' && new Date(deposit.time_limit) < new Date()) {
    deposit.updateStatus('expired');
    return deposit;
  }
  return deposit;
}

// Export deposits for access by other routes
function getDeposits() {
  return deposits;
}

// POST /deposit - Create a new deposit
router.post('/', sanitizeInput, depositValidation, handleValidationErrors, (req, res) => {
  try {
    const { amount, requirement, time_limit, creator_id, receiver_id, creator_email, receiver_email } = req.body;

    const deposit = new Deposit({
      amount: parseFloat(amount),
      requirement,
      time_limit: new Date(time_limit),
      creator_id,
      receiver_id,
      creator_email,
      receiver_email
    });

    deposits.set(deposit.id, deposit);

    res.status(201).json({
      message: 'Deposit created successfully',
      deposit: deposit.toJSON()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// GET /deposit/:id - Check deposit details
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;

    if (!validator.isUUID(id)) {
      return res.status(400).json({
        error: 'Invalid deposit ID format'
      });
    }

    const deposit = deposits.get(id);

    if (!deposit) {
      return res.status(404).json({
        error: 'Deposit not found'
      });
    }

    // Check if deposit has expired
    const updatedDeposit = checkExpiration(deposit);
    if (updatedDeposit !== deposit) {
      deposits.set(id, updatedDeposit);
    }

    res.json({
      deposit: updatedDeposit.toJSON()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// PUT /deposit/:id/fulfill - Mark requirement fulfilled
router.put('/:id/fulfill', (req, res) => {
  try {
    const { id } = req.params;

    if (!validator.isUUID(id)) {
      return res.status(400).json({
        error: 'Invalid deposit ID format'
      });
    }

    const deposit = deposits.get(id);

    if (!deposit) {
      return res.status(404).json({
        error: 'Deposit not found'
      });
    }

    // Check if deposit has expired
    const updatedDeposit = checkExpiration(deposit);
    if (updatedDeposit.status === 'expired') {
      deposits.set(id, updatedDeposit);
      return res.status(400).json({
        error: 'Cannot fulfill: deposit has expired',
        deposit: updatedDeposit.toJSON()
      });
    }

    // Update deposit reference if it was changed
    if (updatedDeposit !== deposit) {
      deposits.set(id, updatedDeposit);
    }

    // Check if already fulfilled
    if (updatedDeposit.status === 'fulfilled') {
      return res.status(400).json({
        error: 'Deposit already fulfilled',
        deposit: updatedDeposit.toJSON()
      });
    }

    updatedDeposit.updateStatus('fulfilled');
    deposits.set(id, updatedDeposit);

    res.json({
      message: 'Deposit requirement fulfilled successfully',
      deposit: updatedDeposit.toJSON()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// GET /deposit - Get all deposits (for testing/debugging)
router.get('/', (req, res) => {
  try {
    const allDeposits = Array.from(deposits.values()).map(deposit => deposit.toJSON());
    res.json({
      deposits: allDeposits,
      count: allDeposits.length
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = { router, getDeposits };
