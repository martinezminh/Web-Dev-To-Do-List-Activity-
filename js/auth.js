/* ==========================================================================
   Mission Board — auth page logic
   ========================================================================== */

(function () {
  // If already signed in, skip straight to the board.
  if (Session.get()) {
    window.location.href = 'tasks.html';
    return;
  }

  const signinPanel = document.getElementById('signin-panel');
  const signupPanel = document.getElementById('signup-panel');

  document.getElementById('show-signup').addEventListener('click', () => {
    signinPanel.style.display = 'none';
    signupPanel.style.display = 'block';
  });

  document.getElementById('show-signin').addEventListener('click', () => {
    signupPanel.style.display = 'none';
    signinPanel.style.display = 'block';
  });

  function setStatus(el, message, type) {
    el.innerHTML = message
      ? `<div class="form-status ${type}">${escapeHtml(message)}</div>`
      : '';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function setLoading(button, isLoading, label) {
    button.disabled = isLoading;
    button.textContent = isLoading ? 'Please wait…' : label;
  }

  /* ---------------- Sign In ---------------- */

  const signinForm = document.getElementById('signin-form');
  const signinStatus = document.getElementById('signin-status');
  const signinSubmit = document.getElementById('signin-submit');

  signinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setStatus(signinStatus, '', null);

    const email = document.getElementById('signin-email').value.trim();
    const password = document.getElementById('signin-password').value;

    setLoading(signinSubmit, true, 'Sign In');
    try {
      const res = await Api.signIn({ email, password });
      Session.save({
        id: res.data.id,
        firstName: res.data.fname,
        lastName: res.data.lname,
        email: res.data.email,
      });
      window.location.href = 'tasks.html';
    } catch (err) {
      setStatus(signinStatus, err.message, 'error');
      setLoading(signinSubmit, false, 'Sign In');
    }
  });

  /* ---------------- Sign Up ---------------- */

  const signupForm = document.getElementById('signup-form');
  const signupStatus = document.getElementById('signup-status');
  const signupSubmit = document.getElementById('signup-submit');

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setStatus(signupStatus, '', null);

    const firstName = document.getElementById('signup-first-name').value.trim();
    const lastName = document.getElementById('signup-last-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm').value;

    if (password !== confirmPassword) {
      setStatus(signupStatus, 'Passwords do not match.', 'error');
      return;
    }

    setLoading(signupSubmit, true, 'Create Account');
    try {
      await Api.signUp({ firstName, lastName, email, password, confirmPassword });

      // Account created — sign the user straight in for a smooth handoff.
      const res = await Api.signIn({ email, password });
      Session.save({
        id: res.data.id,
        firstName: res.data.fname,
        lastName: res.data.lname,
        email: res.data.email,
      });
      window.location.href = 'tasks.html';
    } catch (err) {
      setStatus(signupStatus, err.message, 'error');
      setLoading(signupSubmit, false, 'Create Account');
    }
  });
})();