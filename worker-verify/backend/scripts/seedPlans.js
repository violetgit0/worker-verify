/**
 * Seed subscription plans.
 * Run: node scripts/seedPlans.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Plan = require('../models/Plan');

const plans = [
  {
    name: 'Free Trial',
    key:  'trial',
    description: '30-day free trial with limited resources',
    monthlyPrice: 0,
    yearlyPrice:  0,
    currency:     'NGN',
    maxWorkers:   20,
    maxBranches:  2,
    maxStaff:     5,
    features:     ['Worker registration', 'Attendance tracking', 'Basic payroll', '2 branches', '5 staff accounts'],
    isActive:     true,
    sortOrder:    0
  },
  {
    name: 'Basic',
    key:  'basic',
    description: 'Small businesses getting started',
    monthlyPrice: 1500000,  // ₦15,000 in kobo
    yearlyPrice:  15000000, // ₦150,000 in kobo
    currency:     'NGN',
    maxWorkers:   100,
    maxBranches:  5,
    maxStaff:     15,
    features:     ['100 workers', '5 branches', '15 staff', 'Attendance & payroll', 'Activity logs', 'Email support'],
    isActive:     true,
    sortOrder:    1
  },
  {
    name: 'Standard',
    key:  'standard',
    description: 'Growing businesses with multiple branches',
    monthlyPrice: 3500000,  // ₦35,000 in kobo
    yearlyPrice:  35000000, // ₦350,000 in kobo
    currency:     'NGN',
    maxWorkers:   500,
    maxBranches:  20,
    maxStaff:     50,
    features:     ['500 workers', '20 branches', '50 staff', 'All Basic features', 'Security alerts', 'Priority support', 'White-label branding'],
    isActive:     true,
    sortOrder:    2
  },
  {
    name: 'Enterprise',
    key:  'enterprise',
    description: 'Large organizations with unlimited needs',
    monthlyPrice: 10000000,  // ₦100,000 in kobo
    yearlyPrice:  100000000, // ₦1,000,000 in kobo
    currency:     'NGN',
    maxWorkers:   -1,   // unlimited
    maxBranches:  -1,
    maxStaff:     -1,
    features:     ['Unlimited workers', 'Unlimited branches', 'Unlimited staff', 'All Standard features', 'Dedicated support', 'Custom integrations', 'SLA guarantee'],
    isActive:     true,
    sortOrder:    3
  }
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected\n');

  for (const plan of plans) {
    const existing = await Plan.findOne({ key: plan.key });
    if (existing) {
      await Plan.findOneAndUpdate({ key: plan.key }, plan);
      console.log(`Updated: ${plan.name}`);
    } else {
      await Plan.create(plan);
      console.log(`Created: ${plan.name}`);
    }
  }

  console.log('\n✓ Plans seeded');
  process.exit(0);
}

main().catch(err => { console.error(err.message); process.exit(1); });
