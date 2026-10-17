/**
 * AURA Transactional Email Verification Suite
 * Tests:
 * 1. Email format syntax validation
 * 2. Welcome email dispatch (live or simulated fallback)
 * 3. Password reset email dispatch
 * 4. Notification email dispatch
 */

import { emailService } from './src/services/email.service.js';

async function runEmailVerification() {
  console.log('====================================================');
  console.log('AURA RESEND EMAIL VERIFICATION SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let total = 4;

  // 1. Invalid email rejection
  console.log('TEST 1: Invalid Email Syntax Rejection');
  try {
    const invalidRes = await emailService.sendWelcomeEmail('not-an-email', 'Hacker');
    if (!invalidRes.success && invalidRes.error?.includes('Invalid recipient email')) {
      console.log('  -> PASS: Malformed email addresses safely rejected.\n');
      passed++;
    } else {
      throw new Error(`Unexpected result: ${JSON.stringify(invalidRes)}`);
    }
  } catch (err: any) {
    console.error('  -> FAIL (Test 1):', err.message, '\n');
  }

  // 2. Welcome Email
  console.log('TEST 2: Welcome Email Workflow');
  try {
    const welcomeRes = await emailService.sendWelcomeEmail('delivered@resend.dev', 'Alex Mercer');
    console.log(`  Result: success=${welcomeRes.success}, simulated=${welcomeRes.simulated}, messageId=${welcomeRes.messageId || 'none'}`);
    if (welcomeRes.success) {
      console.log('  -> PASS: Welcome email dispatched successfully.\n');
      passed++;
    } else {
      throw new Error(`Welcome dispatch failed: ${welcomeRes.error}`);
    }
  } catch (err: any) {
    console.error('  -> FAIL (Test 2):', err.message, '\n');
  }

  // 3. Password Reset Email
  console.log('TEST 3: Password Reset Email Workflow');
  try {
    const resetRes = await emailService.sendPasswordResetEmail(
      'delivered@resend.dev',
      'https://aura.audio/auth/reset-password?token=safe_simulated_token'
    );
    console.log(`  Result: success=${resetRes.success}, simulated=${resetRes.simulated}`);
    if (resetRes.success) {
      console.log('  -> PASS: Password reset email dispatched successfully.\n');
      passed++;
    } else {
      throw new Error(`Reset dispatch failed: ${resetRes.error}`);
    }
  } catch (err: any) {
    console.error('  -> FAIL (Test 3):', err.message, '\n');
  }

  // 4. Notification Email
  console.log('TEST 4: Notification Email Workflow (Shared Playlist)');
  try {
    const notifRes = await emailService.sendNotificationEmail(
      'delivered@resend.dev',
      'Echo invited you to collaborate on "Cyberpunk 2099"',
      'New Playlist Collaboration Invite',
      '<p><strong>Echo</strong> invited you to add tracks to their collaborative lossless playlist <strong>Cyberpunk 2099</strong>.</p>',
      { text: 'View Playlist', url: 'https://aura.audio/playlist/pl-cyberpunk' }
    );
    console.log(`  Result: success=${notifRes.success}, simulated=${notifRes.simulated}`);
    if (notifRes.success) {
      console.log('  -> PASS: Notification email dispatched successfully.\n');
      passed++;
    } else {
      throw new Error(`Notification dispatch failed: ${notifRes.error}`);
    }
  } catch (err: any) {
    console.error('  -> FAIL (Test 4):', err.message, '\n');
  }

  console.log(`SUMMARY: ${passed}/${total} EMAIL TESTS PASSED.`);
  if (passed === total) {
    console.log('Resend email subsystem verified successfully!');
  } else {
    process.exit(1);
  }
}

runEmailVerification().catch((err) => {
  console.error('Email verification error:', err);
  process.exit(1);
});
