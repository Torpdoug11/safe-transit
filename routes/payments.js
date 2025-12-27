const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Deposit = require('../models/Deposit');
const validator = require('validator');

// POST /payment/create-checkout-session - Create Stripe checkout session
router.post('/create-checkout-session', async (req, res) => {
  try {
    const { deposit_id, success_url, cancel_url } = req.body;

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

    // Get deposit from storage (assuming deposits are accessible globally or via database)
    // For now, we'll need to access the deposits from the deposits route
    // This is a simplified approach - in production, use a proper database
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

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      amount: Math.round(deposit.amount * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        deposit_id: deposit_id
      },
      payment_intent_data: {
        metadata: {
          deposit_id: deposit_id
        },
        capture_method: 'manual' // This creates a hold that can be captured later
      },
      success_url: success_url || `${req.protocol}://${req.get('host')}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${req.protocol}://${req.get('host')}/payment/cancel?session_id={CHECKOUT_SESSION_ID}`
    });

    // Update deposit with Stripe session info
    deposit.setStripeCheckoutSessionId(session.id);
    deposit.setStripePaymentIntentId(session.payment_intent);
    deposit.updateStatus('pending_payment');
    deposit.updatePaymentStatus('processing');

    res.json({
      session_id: session.id,
      checkout_url: session.url,
      deposit: deposit.toJSON()
    });
  } catch (error) {
    console.error('Stripe checkout session error:', error);
    res.status(500).json({
      error: 'Failed to create checkout session',
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

    if (!deposit.stripe_payment_intent_id) {
      return res.status(400).json({
        error: 'No payment intent found for this deposit'
      });
    }

    if (deposit.payment_status !== 'completed') {
      return res.status(400).json({
        error: 'Payment must be completed before capturing'
      });
    }

    // Capture the payment
    const paymentIntent = await stripe.paymentIntents.capture(deposit.stripe_payment_intent_id);

    deposit.updatePaymentStatus('captured');

    res.json({
      message: 'Payment captured successfully',
      payment_intent: paymentIntent,
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

    if (!deposit.stripe_payment_intent_id) {
      return res.status(400).json({
        error: 'No payment intent found for this deposit'
      });
    }

    // Cancel the payment intent to release the hold
    const paymentIntent = await stripe.paymentIntents.cancel(deposit.stripe_payment_intent_id);

    deposit.updatePaymentStatus('cancelled');

    res.json({
      message: 'Payment hold released successfully',
      payment_intent: paymentIntent,
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
