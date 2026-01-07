const express = require('express');
const router = express.Router();
const Deposit = require('../models/Deposit');
const validator = require('validator');


// POST /payment/create-payment - Create payment record
router.post('/create-payment', async (req, res) => {
  try {
    const { deposit_id } = req.body;

    if (!deposit_id) {
      return res.status(400).json({
        error: 'Deposit ID is required'
      });
    }

    if (!validator.isUUID(deposit_id)) {
      return res.status(400).json({
        error: 'Invalid deposit ID format'
      });
    }

    const deposits = require('./deposits').getDeposits();
    const deposit = deposits.get(deposit_id);

    if (!deposit) {
      return res.status(404).json({
        error: 'Deposit not found'
      });
    }

    if (deposit.payment_status !== 'pending') {
      return res.status(400).json({
        error: 'Deposit payment has already been processed'
      });
    }

    // Create a simple payment record
    const paymentRecord = {
      id: 'pay_' + Math.random().toString(36).substr(2, 24),
      status: 'pending',
      amount: deposit.amount,
      currency: 'usd',
      created: new Date().toISOString()
    };

    // Update deposit status
    deposit.updateStatus('pending_payment');
    deposit.updatePaymentStatus('processing');

    res.json({
      payment_id: paymentRecord.id,
      status: paymentRecord.status,
      deposit: deposit.toJSON()
    });
  } catch (error) {
    console.error('Payment creation error:', error);
    res.status(500).json({
      error: 'Failed to create payment',
      message: error.message
    });
  }
});

// POST /payment/capture-payment - Capture payment (when deposit is fulfilled)
router.post('/capture-payment', async (req, res) => {
  try {
    const { deposit_id } = req.body;

    if (!deposit_id) {
      return res.status(400).json({
        error: 'Deposit ID is required'
      });
    }

    const deposits = require('./deposits').getDeposits();
    const deposit = deposits.get(deposit_id);

    if (!deposit) {
      return res.status(404).json({
        error: 'Deposit not found'
      });
    }

    if (deposit.payment_status !== 'processing') {
      return res.status(400).json({
        error: 'Payment must be in processing status before capturing'
      });
    }

    // Mark payment as completed
    deposit.updatePaymentStatus('completed');
    deposit.updateStatus('active');

    res.json({
      message: 'Payment captured successfully',
      deposit: deposit.toJSON()
    });
  } catch (error) {
    console.error('Payment capture error:', error);
    res.status(500).json({
      error: 'Failed to capture payment',
      message: error.message
    });
  }
});

// POST /payment/release-payment - Release payment hold (when deposit expires)
router.post('/release-payment', async (req, res) => {
  try {
    const { deposit_id } = req.body;

    if (!deposit_id) {
      return res.status(400).json({
        error: 'Deposit ID is required'
      });
    }

    const deposits = require('./deposits').getDeposits();
    const deposit = deposits.get(deposit_id);

    if (!deposit) {
      return res.status(404).json({
        error: 'Deposit not found'
      });
    }

    if (deposit.payment_status !== 'completed' && deposit.payment_status !== 'captured') {
      return res.status(400).json({
        error: 'Payment must be completed before releasing'
      });
    }

    // Mark payment as refunded
    deposit.updatePaymentStatus('refunded');

    res.json({
      message: 'Payment released successfully',
      deposit: deposit.toJSON()
    });
  } catch (error) {
    console.error('Payment release error:', error);
    res.status(500).json({
      error: 'Failed to release payment',
      message: error.message
    });
  }
});

module.exports = router;
