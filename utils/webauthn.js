import {
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import base64url from 'base64url';
import crypto from 'crypto';

export const getRpId = () => process.env.RP_ID || 'localhost';
export const getOrigin = () => process.env.ORIGIN || `http://localhost:${process.env.PORT || 3000}`;

export const startRegistration = (user, existingCredentials = []) => {
  const challenge = base64url.encode(crypto.randomBytes(32));
  const options = {
    rp: {
      name: process.env.RP_NAME || 'DevOps Todo',
      id: getRpId(),
    },
    user: {
      // base64url string; browser lib will convert to ArrayBuffer
      id: base64url.encode(Buffer.from(user._id.toString())),
      name: user.email,
      displayName: user.name,
    },
    challenge,
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },   // ES256
      { type: 'public-key', alg: -257 }, // RS256
    ],
    timeout: 60000,
    attestation: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
    excludeCredentials: existingCredentials.map((cred) => ({
      id: cred.credentialId, // base64url string
      type: 'public-key',
      transports: cred.transports || undefined,
    })),
    extensions: {
      credProps: true,
    },
  };
  return options;
};

export const finishRegistration = async ({
  user,
  registrationResponse,
}) => {
  const verification = await verifyRegistrationResponse({
    response: registrationResponse,
    expectedChallenge: user.currentChallenge,
    expectedOrigin: getOrigin(),
    expectedRPID: getRpId(),
    requireUserVerification: true,
  });

  const { verified, registrationInfo } = verification;
  if (!verified || !registrationInfo) {
    throw new Error('Registration could not be verified');
  }

  // Support both shapes: v9 top-level fields or newer nested under registrationInfo.credential
  const cred = registrationInfo.credential || registrationInfo;
  const credentialID = cred.credentialID;
  const credentialPublicKey = cred.credentialPublicKey;
  const counter = cred.counter;

  if (!credentialID || !credentialPublicKey) {
    throw new Error('Verified response missing credential details');
  }

  return {
    verified,
    credential: {
      credentialId: base64url.encode(credentialID),
      publicKey: Buffer.isBuffer(credentialPublicKey)
        ? credentialPublicKey.toString('base64')
        : Buffer.from(credentialPublicKey).toString('base64'),
      counter: typeof counter === 'number' ? counter : 0,
      transports: registrationResponse.response?.transports || [],
      backedUp:
        registrationInfo.credentialDeviceType === 'multiDevice'
          ? !!registrationInfo.credentialBackedUp
          : false,
      deviceType: registrationInfo.credentialDeviceType,
    },
  };
};

export const startAuthentication = (user) => {
  const challenge = base64url.encode(crypto.randomBytes(32));
  const opts = {
    challenge,
    timeout: 60000,
    rpId: getRpId(),
    rpID: getRpId(),
    allowCredentials: (user.webAuthnCredentials || []).map((cred) => ({
      id: cred.credentialId, // base64url string
      type: 'public-key',
      transports: cred.transports || undefined,
    })),
    userVerification: 'preferred',
  };
  return opts;
};

export const finishAuthentication = async ({ user, authenticationResponse, authenticator }) => {
  const verification = await verifyAuthenticationResponse({
    response: authenticationResponse,
    expectedChallenge: user.currentChallenge,
    expectedOrigin: getOrigin(),
    expectedRPID: getRpId(),
    requireUserVerification: true,
    authenticator,
  });

  const { verified, authenticationInfo } = verification;
  if (!verified || !authenticationInfo) {
    throw new Error('Authentication failed');
  }

  return {
    verified,
    newCounter: authenticationInfo.newCounter,
  };
};
