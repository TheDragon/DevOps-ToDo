import { apiFetch, initTheme, showToast } from './common.js';

// Normalize helpers for WebAuthn options
const normalizeRegistrationOptions = (opt) => {
  const pk = opt?.publicKey || opt?.options || opt;
  const maybePk = pk?.publicKey || pk;
  return maybePk;
};

const normalizeAuthenticationOptions = (opt) => {
  const pk = opt?.publicKey || opt?.options || opt;
  const maybePk = pk?.publicKey || pk;
  return maybePk;
};

const init = async () => {
  initTheme();

  const registerForm = document.getElementById('register-form');
  const loginForm = document.getElementById('login-form');

  if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(registerForm);
      const payload = Object.fromEntries(formData.entries());
      try {
        const { options, user } = await apiFetch('/api/auth/register/begin', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        const regOptions = normalizeRegistrationOptions(options);
        if (!regOptions || !regOptions.challenge) {
          console.debug('Registration options received (raw):', options);
          showToast('Invalid registration options from server');
          return;
        }
        if (!regOptions.user || !regOptions.user.id) {
          if (user && user.id && user.email && user.name) {
            regOptions.user = {
              id: user.id,
              name: user.email,
              displayName: user.name,
            };
          } else {
            console.debug('Registration options missing user/id, no fallback:', regOptions);
            showToast('Invalid registration options from server');
            return;
          }
        }

        const attResp = await SimpleWebAuthnBrowser.startRegistration(regOptions);

        await apiFetch('/api/auth/register/complete', {
          method: 'POST',
          body: JSON.stringify({ email: payload.email, attestationResponse: attResp }),
        });

        showToast('Passkey registered successfully');
        window.location.href = '/dashboard.html';
      } catch (error) {
        console.error(error);
        showToast(error.message || 'Registration failed');
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(loginForm);
      const payload = Object.fromEntries(formData.entries());
      try {
        const { options } = await apiFetch('/api/auth/login/begin', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        const authOptions = normalizeAuthenticationOptions(options);
        if (!authOptions || !authOptions.challenge) {
          console.debug('Authentication options received (raw):', options);
          showToast('Invalid authentication options from server');
          return;
        }
        console.debug('Normalized auth options before start:', {
          hasChallenge: !!authOptions.challenge,
          rpId: authOptions.rpId || authOptions.rpID,
          allowCredentials: Array.isArray(authOptions.allowCredentials) ? authOptions.allowCredentials.length : 0,
        });

        let assertion;
        try {
          assertion = await SimpleWebAuthnBrowser.startAuthentication(authOptions);
        } catch (err) {
          // Fallback: try usernameless (omit allowCredentials) in case of RP/credential mismatch
          if (err && (err.name === 'NotAllowedError' || String(err).includes('NotAllowedError'))) {
            const fallback = { ...authOptions };
            delete fallback.allowCredentials;
            console.debug('Retrying authentication without allowCredentials');
            assertion = await SimpleWebAuthnBrowser.startAuthentication(fallback);
          } else {
            throw err;
          }
        }

        await apiFetch('/api/auth/login/complete', {
          method: 'POST',
          body: JSON.stringify({ email: payload.email, assertionResponse: assertion }),
        });

        showToast('Signed in successfully');
        window.location.href = '/dashboard.html';
      } catch (error) {
        console.error(error);
        if (error && (error.name === 'NotAllowedError' || String(error).includes('NotAllowedError'))) {
          showToast('No matching passkey or action was cancelled. Ensure you use the same device/browser and host.');
        } else {
          showToast(error.message || 'Login failed');
        }
      }
    });
  }
};

init();
