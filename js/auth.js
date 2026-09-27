// ==========================================================================
// XORONIQ CAR CARE - SECURE ADMIN AUTHENTICATION
// Strict Firebase Auth Session State, Authorized Roles & Route Guard
// ==========================================================================

import { adminSignIn, adminSignOut, onAdminAuthChange, sendAdminResetPassword } from './firebase.js';
import { showToast } from './utils.js';

/**
 * Authorized Administrator Whitelist
 * Includes business founders and designated admin emails
 */
export const AUTHORIZED_ADMIN_EMAILS = [
  'munnashaheemperinchikkal@gmail.com',
  'sanahuhaq0@gmail.com',
  'tobesuccess96@gmail.com',
  'xoroniq@gmail.com',
  'admin@xoroniq.com'
];

/**
 * Validates whether an email has verified administrative clearance
 */
export function isAuthorizedAdminEmail(email) {
  if (!email) return false;
  const clean = email.toLowerCase().trim();
  if (AUTHORIZED_ADMIN_EMAILS.includes(clean)) return true;
  if (clean.endsWith('@xoroniq.store') || clean.endsWith('@xoroniq.com')) return true;
  return false;
}

/**
 * Route Guard for Admin Pages
 * Strict Firebase Auth enforcement with zero bypass
 */
export function requireAdminAuth() {
  // Purge any legacy demo or local session from localStorage immediately
  localStorage.removeItem('xoroniq_admin_session');

  onAdminAuthChange(async (user) => {
    const isLoginPage = window.location.pathname.includes('login.html');

    if (!user) {
      if (!isLoginPage) {
        window.location.replace('login.html');
      }
      return;
    }

    // Verify authenticated user is an authorized administrator
    if (!isAuthorizedAdminEmail(user.email)) {
      console.warn('[Security Alert] Unauthorized admin access attempt rejected for:', user.email);
      await adminSignOut();
      if (!isLoginPage) {
        window.location.replace('login.html?error=unauthorized');
      }
      return;
    }

    // If already authenticated admin and currently on login page, redirect to dashboard
    if (isLoginPage) {
      window.location.replace('index.html');
      return;
    }

    // Update email badge in admin UI
    const emailBadge = document.getElementById('admin-user-email');
    if (emailBadge) {
      emailBadge.textContent = user.email;
    }
  });
}

/**
 * Initialize Admin Login Page
 */
export function initAdminLoginPage() {
  // Purge any legacy demo session
  localStorage.removeItem('xoroniq_admin_session');

  const form = document.getElementById('admin-login-form');
  const emailInput = document.getElementById('admin-email');
  const passwordInput = document.getElementById('admin-password');
  const submitBtn = document.getElementById('admin-login-btn');
  const forgotBtn = document.getElementById('admin-forgot-btn');

  // Check if redirected with unauthorized error
  const params = new URLSearchParams(window.location.search);
  if (params.get('error') === 'unauthorized') {
    const errorBanner = document.getElementById('admin-login-error-banner');
    if (errorBanner) {
      errorBanner.style.display = 'block';
    } else {
      showToast('Access denied: Your account lacks administrator privileges.', 'error');
    }
  }

  // Check if already authenticated as valid admin
  onAdminAuthChange((user) => {
    if (user && isAuthorizedAdminEmail(user.email)) {
      window.location.replace('index.html');
    }
  });

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!email || !password) {
        showToast('Please enter both email and password.', 'warning');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> AUTHENTICATING...`;

      try {
        const userCredential = await adminSignIn(email, password);
        const signedInEmail = userCredential.user?.email || email;

        if (!isAuthorizedAdminEmail(signedInEmail)) {
          await adminSignOut();
          submitBtn.disabled = false;
          submitBtn.innerHTML = `SIGN IN TO DASHBOARD <i class="bi bi-arrow-right ms-2"></i>`;
          showToast('Access Denied: Account lacks administrative privileges.', 'error');
          return;
        }

        showToast('Authentication successful. Welcome, Admin.', 'success');
        setTimeout(() => {
          window.location.replace('index.html');
        }, 500);
      } catch (err) {
        console.warn('Admin authentication failed:', err);
        submitBtn.disabled = false;
        submitBtn.innerHTML = `SIGN IN TO DASHBOARD <i class="bi bi-arrow-right ms-2"></i>`;
        
        let msg = 'Invalid administrator credentials.';
        if (err.code === 'auth/user-not-found') msg = 'No administrator account found with this email.';
        if (err.code === 'auth/wrong-password') msg = 'Incorrect password.';
        if (err.code === 'auth/invalid-credential') msg = 'Invalid email or password.';
        if (err.code === 'auth/too-many-requests') msg = 'Too many failed attempts. Please try again later.';
        
        showToast(msg, 'error');
      }
    });
  }

  if (forgotBtn) {
    forgotBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const email = prompt('Enter your admin email address to receive password reset instructions:');
      if (!email) return;

      try {
        await sendAdminResetPassword(email.trim());
        showToast(`Reset link sent to ${email}`, 'success');
      } catch (err) {
        showToast('Failed to send reset link.', 'error');
      }
    });
  }
}

/**
 * Initialize Logout button
 */
export function initAdminLogout() {
  const logoutBtns = document.querySelectorAll('.admin-logout-btn');
  logoutBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        localStorage.removeItem('xoroniq_admin_session');
        await adminSignOut();
      } catch (err) {
        console.warn('Sign out:', err);
      }
      showToast('Signed out of admin session.', 'info');
      setTimeout(() => {
        window.location.replace('login.html');
      }, 400);
    });
  });
}
