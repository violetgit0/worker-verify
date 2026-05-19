/**
 * Reset staff accounts — keeps ONLY the super_admin, deletes everything else.
 *
 * Run from the backend directory:
 *   node scripts/resetStaff.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');

  // Show what exists before deletion
  const allUsers = await User.find({}).select('fullName username role isActive isDeleted');
  console.log(`Total user documents: ${allUsers.length}`);
  allUsers.forEach(u => {
    const flags = [];
    if (u.isDeleted) flags.push('archived');
    if (!u.isActive && !u.isDeleted) flags.push('suspended');
    console.log(`  [${u.role}] ${u.fullName} (@${u.username})${flags.length ? ' — ' + flags.join(', ') : ''}`);
  });

  const toDelete = allUsers.filter(u => u.role !== 'super_admin');
  if (toDelete.length === 0) {
    console.log('\nNo staff accounts to delete. Database is already clean.');
    process.exit(0);
  }

  console.log(`\nDeleting ${toDelete.length} staff account(s) (keeping super_admin)…`);
  const result = await User.deleteMany({ role: { $ne: 'super_admin' } });
  console.log(`Deleted: ${result.deletedCount} document(s)`);

  // Verify
  const remaining = await User.find({}).select('fullName username role');
  console.log(`\nRemaining accounts (${remaining.length}):`);
  remaining.forEach(u => console.log(`  [${u.role}] ${u.fullName} (@${u.username})`));

  console.log('\n✓ Staff reset complete. You can now create fresh staff accounts.');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
