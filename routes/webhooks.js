const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getDeposits } = require('./deposits');

// POST /webhooks/stripe - Handle Stripe webhooks
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log(`Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const deposits = getDeposits();

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const checkoutSession = event.data.object;
      const depositId = checkoutSession.metadata.deposit_id;
      
      console.log(`Checkout session completed for deposit: ${depositId}`);
      
      const deposit = deposits.get(depositId);
      if (deposit) {
        deposit.updatePaymentStatus('completed');
        deposit.updateStatus('active');
        console.log(`Deposit ${depositId} payment completed, status updated to active`);
      }
      break;

    case 'payment_intent.payment_failed':
      const paymentIntent = event.data.object;
      const failedDepositId = paymentIntent.metadata.deposit_id;
      
      console.log(`Payment failed for deposit: ${failedDepositId}`);
      
      const failedDeposit = deposits.get(failedDepositId);
      if (failedDeposit) {
        failedDeposit.updatePaymentStatus('failed');
        failedDeposit.updateStatus('cancelled');
        console.log(`Deposit ${failedDepositId} payment failed, status updated to cancelled`);
      }
      break;

    case 'payment_intent.canceled':
      const canceledIntent = event.data.object;
      const canceledDepositId = canceledIntent.metadata.deposit_id;
      
      console.log(`Payment canceled for deposit: ${canceledDepositId}`);
      
      const canceledDeposit = deposits.get(canceledDepositId);
      if (canceledDeposit) {
        canceledDeposit.updatePaymentStatus('cancelled');
        console.log(`Deposit ${canceledDepositId} payment canceled`);
      }
      break;

    case 'payment_intent.succeeded':
      const succeededIntent = event.data.object;
      const succeededDepositId = succeededIntent.metadata.deposit_id;
      
      console.log(`Payment succeeded for deposit: ${succeededDepositId}`);
      
      const succeededDeposit = deposits.get(succeededDepositId);
      if (succeededDeposit) {
        // Payment was captured (funds transferred)
        succeededDeposit.updatePaymentStatus('captured');
        console.log(`Deposit ${succeededDepositId} payment captured`);
      }
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  res.json({ received: true });
});

module.exports = router;
