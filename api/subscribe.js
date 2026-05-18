// Receives a PushSubscription from the browser and stores it in Upstash Redis.
// POST /api/subscribe  { endpoint, keys: { p256dh, auth } }
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sub = req.body;
    if (!sub?.endpoint) return res.status(400).json({ error: 'Invalid subscription' });

    // Use the endpoint URL as a unique key (hashed to stay short)
    const id = Buffer.from(sub.endpoint).toString('base64').slice(-40);
    await redis.set(`push:${id}`, JSON.stringify(sub), { ex: 60 * 60 * 24 * 60 }); // 60-day TTL

    // Keep a set of all sub IDs so remind.js can list them
    await redis.sadd('push:ids', id);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('subscribe error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
