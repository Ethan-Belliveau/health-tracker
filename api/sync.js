// POST /api/sync - saves full app state to Vercel KV for cross-device backup.
// Called automatically from the app whenever local data changes.
import { kv } from '@vercel/kv';

const BACKUP_KEY = 'ethan:health-tracker:v1';
const LEGACY_LOG_KEY = 'ethan:log';
const TTL_SECONDS = 60 * 60 * 24 * 400;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    let incoming = req.body || {};
    if (typeof incoming === 'string') incoming = JSON.parse(incoming);
    const state = incoming.state || { log: incoming.log };
    if (!state || !Array.isArray(state.log)) return res.status(400).json({ error: 'Invalid backup state' });

    const backup = {
      state: {
        log: state.log,
        plan: state.plan && typeof state.plan === 'object' ? state.plan : { weekFocus: {}, days: {} },
        metrics: state.metrics && typeof state.metrics === 'object' ? state.metrics : {},
        mealCart: state.mealCart && typeof state.mealCart === 'object' ? state.mealCart : {},
        customMeals: Array.isArray(state.customMeals) ? state.customMeals : [],
        groceryChecked: Array.isArray(state.groceryChecked) ? state.groceryChecked : [],
        updatedAt: state.updatedAt || new Date().toISOString()
      },
      syncedAt: new Date().toISOString()
    };

    await kv.set(BACKUP_KEY, JSON.stringify(backup), { ex: TTL_SECONDS });
    await kv.set(LEGACY_LOG_KEY, JSON.stringify({ log: backup.state.log, syncedAt: backup.syncedAt }), { ex: TTL_SECONDS });

    return res.status(200).json({ ok: true, entries: backup.state.log.length, syncedAt: backup.syncedAt });
  } catch (err) {
    console.error('sync error:', err);
    return res.status(500).json({ error: err.message });
  }
}
