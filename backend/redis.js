import { createClient } from 'redis';

let redisClient = null;
let pubClient = null;
let subClient = null;
let redisEnabled = false;

export const initRedis = async () => {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        console.warn('⚠️ REDIS_URL environment variable is not defined. Running in Standalone Mode without Redis.');
        return { redisClient: null, pubClient: null, subClient: null, redisEnabled: false };
    }

    try {
        redisClient = createClient({ url: redisUrl });
        pubClient = createClient({ url: redisUrl });
        subClient = pubClient.duplicate();

        const handleErr = (name) => (err) => {
            console.error(`❌ [Redis] ${name} connection error:`, err.message);
            redisEnabled = false;
        };

        redisClient.on('error', handleErr('General Client'));
        pubClient.on('error', handleErr('Pub Client'));
        subClient.on('error', handleErr('Sub Client'));

        redisClient.on('connect', () => console.log('🟢 [Redis] General client connecting...'));
        redisClient.on('ready', () => {
            console.log('🟢 [Redis] General client ready');
            redisEnabled = true;
        });

        await Promise.all([
            redisClient.connect(),
            pubClient.connect(),
            subClient.connect()
        ]);

        console.log('🟢 [Redis] All connections established successfully');
        redisEnabled = true;
        return { redisClient, pubClient, subClient, redisEnabled: true };
    } catch (err) {
        console.error('❌ [Redis] Failed to initialize Redis connections:', err.message);
        redisEnabled = false;
        return { redisClient: null, pubClient: null, subClient: null, redisEnabled: false };
    }
};

export const getRedisClient = () => redisClient;
export const getPubClient = () => pubClient;
export const getSubClient = () => subClient;
export const isRedisEnabled = () => redisEnabled;
