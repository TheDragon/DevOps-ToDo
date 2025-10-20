import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import base64url from 'base64url';

export const getRpId = () => process.env.RP_ID || 'localhost';
export const getOrigin = () => process.env.ORIGIN || `http://localhost:${process.env.PORT || 3000}`;

export const startRegistration = (user, existingCredentials = []) => {
  return generateRegistrationOptions({
    rpName: process.env.RP_NAME || 'DevOps Todo',
    rpID: getRpId(),
    userID: user._id.toString(),
    userName: user.email,
    userDisplayName: user.name,
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
    excludeCredentials: existingCredentials.map((cred) => ({
      id: base64url.toBuffer(cred.credentialId),
      type: 'public-key',
    })),
    extensions: {
      credProps: true,
    },
  });
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

  const { credential } = registrationInfo;

  return {
    verified,
    credential: {
      credentialId: base64url.encode(credential.credentialID),
      publicKey: credential.credentialPublicKey.toString('base64'),
      counter: credential.counter,
      transports: registrationResponse.response?.transports || [],
      backedUp: registrationInfo.credentialDeviceType === 'multiDevice'
        ? registrationInfo.credentialBackedUp
        : false,
      deviceType: registrationInfo.credentialDeviceType,
    },
  };
};

export const startAuthentication = (user) => {
  return generateAuthenticationOptions({
    rpID: getRpId(),
    allowCredentials: user.webAuthnCredentials.map((cred) => ({
      id: base64url.toBuffer(cred.credentialId),
      type: 'public-key',
      transports: cred.transports,
    })),
    userVerification: 'preferred',
  });
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
