import mongoose from 'mongoose';

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/devops_todo';
  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(mongoUri, {
      dbName: process.env.MONGODB_DB || undefined,
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

export default connectDB;
