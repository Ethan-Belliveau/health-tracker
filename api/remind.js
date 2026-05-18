// Cron job: runs at 9pm Eastern (01:00 UTC, adjusted for EDT).
// Sends a web push notification to all stored subscribers.
// Trigger: vercel.json cron at "0 1 * * *"
import { Redis } from '@upstash/redis';
import webpush from 'web-push';

const redis = Redis.fromEnv();

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  // Allow manual trigger via browser, but primarily called by Vercel Cron
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end();

  try {
    const ids = await redis.smembers('push:ids');
    if (!ids || ids.length === 0) return res.json({ sent: 0, note: 'No subscribers' });

    const payload = JSON.stringify({
      title: "Log your day",
      body:  "Time to fill in tonight's log - distance, sleep, workout and food."
    });

    let sent = 0, failed = 0;
    await Promise.all(ids.map(async id => {
      try {
        const raw = await redis.get(`push:${id}`);
        if (!raw) { await redis.srem('push:ids', id); return; }
        const sub = typeof raw === 'string' ? JSON.parse(raw) : raw;
        await webpush.sendNotification(sub, payload);
        sent++;
      } catch (err) {
        failed++;
        // 410 Gone = subscription expired/revoked → remove it
        if (err.statusCode === 410 || err.statusCode === 404) {
          await redis.del(`push:${id}`);
          await redis.srem('push:ids', id);
        }
        console.error('push error for', id, err.statusCode || err.message);
      }
    }));

    return res.json({ sent, failed });
  } catch (err) {
    console.error('remind handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
