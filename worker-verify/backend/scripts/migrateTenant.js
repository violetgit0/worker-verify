/**
 * One-time migration: converts existing single-tenant data into the first company.
 *
 * Run ONCE after deploying the multi-tenant update:
 *   node scripts/migrateTenant.js
 *
 * What it does:
 *  1. Creates "Sage Energy" as the first Company (enterprise plan, no expiry)
 *  2. Converts the existing super_admin to company_admin for Sage Energy
 *  3. Stamps all Workers, Branches, Attendance, Payroll, Deductions, DeductionRules,
 *     SecurityAlerts, ActivityLogs with the new company ID
 *  4. Creates a new platform super_admin account (credentials printed to console)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const Company       = require('../models/Company');
const User          = require('../models/User');
const Worker        = require('../models/Worker');
const Branch        = require('../models/Branch');
const Attendance    = require('../models/Attendance');
const Payroll       = require('../models/Payroll');
const Deduction     = require('../models/Deduction');
const DeductionRule = require('../models/DeductionRule');
const SecurityAlert = require('../models/SecurityAlert');
const ActivityLog   = require('../models/ActivityLog');
const Plan          = require('../models/Plan');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected\n');

  // ── 1. Check if migration already ran ────────────────────────────────────
  const existingCompany = await Company.findOne({ slug: 'sage-energy' });
  if (existingCompany) {
    console.log('Migration already ran — Sage Energy company exists:', existingCompany._id);
    console.log('If you need to re-run, delete the company record first.');
    process.exit(0);
  }

  // ── 2. Find existing super_admin ─────────────────────────────────────────
  const existingAdmin = await User.findOne({ role: 'super_admin', company: null });
  if (!existingAdmin) {
    console.error('No super_admin user found. Run createAdmin.js first.');
    process.exit(1);
  }
  console.log(`Found existing admin: ${existingAdmin.fullName} (@${existingAdmin.username})`);

  // ── 3. Create the company ─────────────────────────────────────────────────
  const company = await Company.create({
    name:               'Sage Energy',
    slug:               'sage-energy',
    email:              existingAdmin.email,
    phone:              existingAdmin.phone || '',
    plan:               'enterprise',
    planStatus:         'active',
    subscriptionStartAt: new Date(),
    subscriptionEndsAt:  new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000), // 10 years
    maxWorkers:         -1,
    maxBranches:        -1,
    maxStaff:           -1,
    emailVerified:      true,
    adminUser:          existingAdmin._id
  });
  console.log(`\nCreated company: ${company.name} (${company._id})`);

  // ── 4. Convert existing admin to company_admin ────────────────────────────
  await User.updateOne({ _id: existingAdmin._id }, {
    $set: { company: company._id, role: 'company_admin' }
  });
  console.log(`Converted ${existingAdmin.username} → company_admin for Sage Energy`);

  // ── 5. Stamp all existing staff with company ──────────────────────────────
  const otherStaff = await User.updateMany(
    { company: null, role: { $ne: 'super_admin' } },
    { $set: { company: company._id } }
  );
  console.log(`Stamped ${otherStaff.modifiedCount} staff accounts with company`);

  // ── 6. Stamp all data collections ────────────────────────────────────────
  const [w, b, a, p, d, dr, sa, al] = await Promise.all([
    Worker.updateMany(      { company: null }, { $set: { company: company._id } }),
    Branch.updateMany(      { company: null }, { $set: { company: company._id } }),
    Attendance.updateMany(  { company: null }, { $set: { company: company._id } }),
    Payroll.updateMany(     { company: null }, { $set: { company: company._id } }),
    Deduction.updateMany(   { company: null }, { $set: { company: company._id } }),
    DeductionRule.updateMany({ company: null }, { $set: { company: company._id } }),
    SecurityAlert.updateMany({ company: null }, { $set: { company: company._id } }),
    ActivityLog.updateMany( { company: null }, { $set: { company: company._id } })
  ]);

  console.log(`
Stamped records:
  Workers:        ${w.modifiedCount}
  Branches:       ${b.modifiedCount}
  Attendance:     ${a.modifiedCount}
  Payroll:        ${p.modifiedCount}
  Deductions:     ${d.modifiedCount}
  Deduction Rules:${dr.modifiedCount}
  Security Alerts:${sa.modifiedCount}
  Activity Logs:  ${al.modifiedCount}`);

  // ── 7. Create new platform super_admin ───────────────────────────────────
  const platformPassword = `Platform${Math.random().toString(36).slice(2, 10).toUpperCase()}!`;
  await User.create({
    company:  null,
    fullName: 'Platform Admin',
    username: 'platform_admin',
    email:    `platform@workersave.internal`,
    phone:    '00000000000',
    password: platformPassword,
    role:     'super_admin'
  });

  console.log(`
╔══════════════════════════════════════════════════════╗
║           PLATFORM SUPER ADMIN CREATED               ║
╠══════════════════════════════════════════════════════╣
║  Username : platform_admin                           ║
║  Password : ${platformPassword.padEnd(40)}║
║  Login at : /superadmin/login.html                   ║
╚══════════════════════════════════════════════════════╝
SAVE THIS PASSWORD — it will not be shown again.`);

  console.log('\n✓ Migration complete. Your existing data is now under Sage Energy company.');
  console.log(`  Company slug: sage-energy`);
  console.log(`  Login URL:    /index.html (enter company slug: sage-energy)`);

  process.exit(0);
}

main().catch(err => { console.error('[Migration Error]', err.message); process.exit(1); });
