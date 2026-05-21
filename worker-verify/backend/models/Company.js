const mongoose = require('mongoose');

const PLANS = ['trial', 'basic', 'standard', 'enterprise'];
const PLAN_STATUS = ['active', 'expired', 'suspended', 'cancelled'];

const brandingSchema = new mongoose.Schema({
  logo:         { type: String, default: '' },
  primaryColor: { type: String, default: '#4DA3FF' },
  accentColor:  { type: String, default: '#1d4ed8' },
  favicon:      { type: String, default: '' }
}, { _id: false });

const billingSchema = new mongoose.Schema({
  provider:       { type: String, enum: ['paystack', 'stripe', 'flutterwave', ''], default: '' },
  customerId:     { type: String, default: '' },
  subscriptionId: { type: String, default: '' },
  planCode:       { type: String, default: '' },
  nextPaymentDate: { type: Date, default: null }
}, { _id: false });

const companySchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  slug:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  email:       { type: String, required: true, lowercase: true, trim: true },
  phone:       { type: String, default: '' },
  address:     { type: String, default: '' },
  industry:    { type: String, default: '' },
  website:     { type: String, default: '' },
  country:     { type: String, default: 'Nigeria' },

  // Subscription
  plan:               { type: String, enum: PLANS, default: 'trial' },
  planStatus:         { type: String, enum: PLAN_STATUS, default: 'active' },
  trialEndsAt:        { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  subscriptionStartAt:{ type: Date, default: null },
  subscriptionEndsAt: { type: Date, default: null },

  // Plan limits (copied from Plan at subscription time)
  maxWorkers:  { type: Number, default: 20 },
  maxBranches: { type: Number, default: 2 },
  maxStaff:    { type: Number, default: 5 },

  // White label
  branding: { type: brandingSchema, default: () => ({}) },

  // Billing
  billing: { type: billingSchema, default: () => ({}) },

  // Status
  isActive:       { type: Boolean, default: true },
  suspendedAt:    { type: Date, default: null },
  suspendedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  suspendReason:  { type: String, default: '' },

  // Email verification
  emailVerified:  { type: Boolean, default: false },
  emailVerifyToken: { type: String, default: '' },

  // Admin user (ref to the first company_admin created)
  adminUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // Metadata
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

companySchema.index({ slug: 1 }, { unique: true });
companySchema.index({ email: 1 });
companySchema.index({ plan: 1, planStatus: 1 });
companySchema.index({ isActive: 1 });

companySchema.virtual('isTrialExpired').get(function () {
  return this.plan === 'trial' && this.trialEndsAt && new Date() > this.trialEndsAt;
});

companySchema.virtual('isSubscriptionExpired').get(function () {
  return this.subscriptionEndsAt && new Date() > this.subscriptionEndsAt;
});

module.exports = mongoose.model('Company', companySchema);
module.exports.PLANS = PLANS;
