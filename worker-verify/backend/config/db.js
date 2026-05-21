const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 60000,
      socketTimeoutMS:          60000,
      maxPoolSize:              10,
      retryWrites:              true
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    mongoose.connection.on('disconnected', () => {
      console.warn('[MongoDB] Disconnected. Mongoose will auto-reconnect.');
    });
    mongoose.connection.on('reconnected', () => {
      console.log('[MongoDB] Reconnected.');
    });
    mongoose.connection.on('error', (err) => {
      console.error('[MongoDB] Connection error:', err.message);
    });
  } catch (err) {
    console.error('MongoDB initial connection failed:', err.message);
    console.warn('Server will continue — Mongoose will keep retrying in the background.');
  }
};

module.exports = connectDB;
