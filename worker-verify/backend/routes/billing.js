/**
 * Billing routes — structure prepared for Paystack, Flutterwave, and Stripe.
 * Payment gateway integration goes here when billing credentials are configured.
 */
const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const { companyScope } = require('../middleware/companyScope');
const { authorize } = require('../middleware/roleCheck');
const Company = require('../models/Company');

router.use(protect, companyScope, authorize('company_admin', 'super_admin'));

// Get current subscription info
router.get('/subscription', async (req, res) => {
  try {
    const company = await Company.findById(req.companyId)
      .select('name plan planStatus trialEndsAt subscriptionStartAt subscriptionEndsAt maxWorkers maxBranches maxStaff billing');
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });
    res.json({ success: true, subscription: company });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Initiate payment — TODO: integrate Paystack / Stripe / Flutterwave
router.post('/initiate', async (req, res) => {
  const { plan, interval, provider = 'paystack' } = req.body;
  // TODO: Create payment session with chosen provider
  // Paystack: call https://api.paystack.co/transaction/initialize
  // Stripe:   call stripe.checkout.sessions.create(...)
  // Flutterwave: call https://api.flutterwave.com/v3/payments
  res.json({
    success: false,
    message: `Payment via ${provider} not yet configured. Add API keys to environment variables.`,
    requiredEnvVars: {
      paystack:      ['PAYSTACK_SECRET_KEY'],
      stripe:        ['STRIPE_SECRET_KEY'],
      flutterwave:   ['FLW_SECRET_KEY']
    }
  });
});

// Webhook: Paystack
router.post('/webhook/paystack', express.raw({ type: 'application/json' }), async (req, res) => {
  // TODO: Verify Paystack signature (x-paystack-signature header)
  // On charge.success → update company plan + subscriptionEndsAt
  res.sendStatus(200);
});

// Webhook: Stripe
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  // TODO: Verify Stripe signature (stripe-signature header)
  // On invoice.payment_succeeded → update company plan
  res.sendStatus(200);
});

// Webhook: Flutterwave
router.post('/webhook/flutterwave', async (req, res) => {
  // TODO: Verify Flutterwave secret hash
  res.sendStatus(200);
});

module.exports = router;
