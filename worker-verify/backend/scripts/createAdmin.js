/**
 * Run once to seed the Super Admin account:
 *   cd backend && node scripts/createAdmin.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const existing = await User.findOne({ role: 'super_admin' });
  if (existing) {
    console.log('Super Admin already exists:', existing.username);
    process.exit(0);
  }

  await User.create({
    fullName: 'Super Admin',
    username: 'admin',
    email:    'admin@sage-energy.com',
    phone:    '08000000000',
    password: 'Admin@1234',
    role:     'super_admin'
  });

  console.log('');
  console.log('✓ Super Admin created successfully');
  console.log('  Username : admin');
  console.log('  Password : Admin@1234');
  console.log('  ⚠  Change the password immediately after first login!');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
