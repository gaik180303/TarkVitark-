import { beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Env must be set before any app/model module is imported by a test file.
process.env.NODE_ENV = 'test';
process.env.ACCESS_TOKEN_SECRET = 'test-access-secret';
process.env.ACCESS_TOKEN_EXPIRY = '1d';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret';
process.env.REFRESH_TOKEN_EXPIRY = '10d';
process.env.CORS_ORIGIN = 'http://localhost:5173';

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
