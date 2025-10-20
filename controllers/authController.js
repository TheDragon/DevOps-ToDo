import { v4 as uuidv4 } from 'uuid';
import base64url from 'base64url';
import crypto from 'crypto';
import User from '../models/User.js';
import {
  startRegistration,
  finishRegistration,
  startAuthentication,
  finishAuthentication,
} from '../utils/webauthn.js';

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  avatarUrl: user.avatarUrl,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const beginRegistration = async (req, res) => {
  try {
    const { name, email, avatarUrl } = req.body;
    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }

    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      user = await User.create({ name, email: email.toLowerCase(), avatarUrl });
    } else {
      user.name = name;
      user.avatarUrl = avatarUrl;
    }

    const options = startRegistration(user, user.webAuthnCredentials || []);
    console.log('Registration options keys:', Object.keys(options), 'hasUser:', !!options.user, 'hasChallenge:', !!options.challenge, 'hasPKCP:', Array.isArray(options.pubKeyCredParams));
    user.currentChallenge = options.challenge;
    await user.save();

    res.json({ options, user: sanitizeUser(user) });
  } catch (error) {
    console.error('Registration error', error);
    res.status(500).json({ message: 'Unable to start registration', error: error.message });
  }
};

export const completeRegistration = async (req, res) => {
  try {
    const { email, attestationResponse } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user || !user.currentChallenge) {
      return res.status(400).json({ message: 'Registration challenge not found' });
    }

    const verification = await finishRegistration({
      user,
      registrationResponse: attestationResponse,
    });

    const existing = user.webAuthnCredentials.find(
      (cred) => cred.credentialId === verification.credential.credentialId
    );
    if (!existing) {
      user.webAuthnCredentials.push(verification.credential);
    }
    user.currentChallenge = undefined;
    await user.save();

    req.session.userId = user._id.toString();
    res.json({ verified: verification.verified, user: sanitizeUser(user) });
  } catch (error) {
    console.error('Complete registration error', error);
    res.status(400).json({ message: 'Failed to complete registration', error: error.message });
  }
};

export const beginAuthentication = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() });

    if (!user || !user.webAuthnCredentials?.length) {
      return res.status(404).json({ message: 'User or credentials not found' });
    }

    const options = startAuthentication(user);
    // Prefer discoverable credentials UX: omit allowCredentials to let Windows/OS offer matching passkeys
    if (options && options.allowCredentials) {
      delete options.allowCredentials;
    }
    console.log('Authentication options keys:', Object.keys(options), 'hasAllowCreds:', Array.isArray(options.allowCredentials));
    user.currentChallenge = options.challenge;
    await user.save();

    res.json({ options });
  } catch (error) {
    console.error('Authentication start error', error);
    res.status(500).json({ message: 'Unable to start authentication', error: error.message });
  }
};

export const completeAuthentication = async (req, res) => {
  try {
    const { email, assertionResponse } = req.body;
    let user = null;
    if (email) {
      user = await User.findOne({ email: email?.toLowerCase() });
    }
    // Support usernameless/discoverable login fallback
    if (!user && assertionResponse?.id) {
      user = await User.findOne({ 'webAuthnCredentials.credentialId': assertionResponse.id });
    }

    if (!user || !user.currentChallenge) {
      return res.status(400).json({ message: 'Authentication challenge missing' });
    }

    const requestedIdBuf = base64url.toBuffer(assertionResponse.id);
    const storedCredential = user.webAuthnCredentials.find((cred) => {
      try {
        const cid = base64url.toBuffer(cred.credentialId);
        return Buffer.compare(cid, requestedIdBuf) === 0;
      } catch (_) {
        return false;
      }
    });
    if (!storedCredential) {
      console.warn('Credential not registered for user', {
        email: user.email,
        providedId: assertionResponse.id,
        registeredIds: user.webAuthnCredentials.map((c) => c.credentialId),
      });
      return res.status(404).json({ message: 'Credential not registered' });
    }

    const verification = await finishAuthentication({
      user,
      authenticationResponse: assertionResponse,
      authenticator: {
        credentialID: base64url.toBuffer(storedCredential.credentialId),
        credentialPublicKey: Buffer.from(storedCredential.publicKey, 'base64'),
        counter: storedCredential.counter,
        transports: storedCredential.transports,
      },
    });

    storedCredential.counter = verification.newCounter;
    user.currentChallenge = undefined;
    user.lastLoginAt = new Date();
    await user.save();

    req.session.userId = user._id.toString();
    res.json({ verified: verification.verified, user: sanitizeUser(user) });
  } catch (error) {
    console.error('Complete authentication error', error);
    res.status(400).json({ message: 'Authentication failed', error: error.message });
  }
};

export const getProfile = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const user = await User.findById(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: 'Session invalid' });
    }

    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load profile', error: error.message });
  }
};

export const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Failed to log out' });
    }
    res.clearCookie('devops.todo.sid');
    res.json({ message: 'Logged out' });
  });
};
