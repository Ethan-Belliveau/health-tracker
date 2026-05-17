// Returns the VAPID public key to the browser so it can subscribe to push.
// Set VAPID_PUBLIC_KEY in Vercel Environment Variables.
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return res.status(503).json({ error: 'VAPID not configured' });
  res.json({ vapidPublicKey: key });
}
