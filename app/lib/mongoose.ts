import 'server-only';
import mongoose, { Mongoose } from 'mongoose';

declare global {
    var mongoose: { conn: Mongoose | null; promise: Promise<Mongoose> | null } | undefined;
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
}
const uri: string = MONGODB_URI;

// Strips credentials from a MongoDB URI for safe logging
function sanitizeUri(rawUri: string): string {
    return rawUri.replace(/:\/\/[^@]+@/, '://***@');
}

// Global cached connection to prevent multiple connections in development
const cached = global.mongoose ?? (global.mongoose = { conn: null, promise: null });
mongoose.connection.on('error', (err) => {
    console.error(`MongoDB error [${sanitizeUri(uri)}]:`, err);
});
mongoose.connection.on('disconnected', () => {
    console.warn(`MongoDB disconnected [${sanitizeUri(uri)}]`);
});

async function dbConnect(): Promise<Mongoose> {
    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        const opts = {
            bufferCommands: false,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            ssl: true
        };

        cached.promise = mongoose.connect(uri, opts);
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        throw e;
    }

    return cached.conn;
}

export default dbConnect;
