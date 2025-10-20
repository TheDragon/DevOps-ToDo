import mongoose from 'mongoose';

const webAuthnCredentialSchema = new mongoose.Schema(
  {
    credentialId: { type: String, required: true, unique: true },
    publicKey: { type: String, required: true },
    counter: { type: Number, default: 0 },
    transports: [{ type: String }],
    backedUp: { type: Boolean, default: false },
    deviceType: { type: String, enum: ['singleDevice', 'multiDevice'], default: 'multiDevice' },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    avatarUrl: { type: String },
    webAuthnCredentials: [webAuthnCredentialSchema],
    currentChallenge: { type: String },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

export default User;
