// GET /api/load - returns the cloud-backed app state from Upstash Redis.
// Falls back to the older log-only key if the full backup has not been created yet.
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

const BACKUP_KEY = 'ethan:health-tracker:v1';
const LEGACY_LOG_KEY = 'ethan:log';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const raw = await redis.get(BACKUP_KEY);
    if (raw) {
      const backup = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return res.status(200).json(backup);
    }

    const legacyRaw = await redis.get(LEGACY_LOG_KEY);
    if (!legacyRaw) return res.status(200).json({ state: null, syncedAt: null });

    const legacy = typeof legacyRaw === 'string' ? JSON.parse(legacyRaw) : legacyRaw;
    return res.status(200).json({
      state: {
        log: Array.isArray(legacy.log) ? legacy.log : [],
        plan: { weekFocus: {}, days: {} },
        metrics: {},
        mealCart: {},
        customMeals: [],
        groceryChecked: [],
        dailyDraft: null,
        updatedAt: legacy.syncedAt || null
      },
      syncedAt: legacy.syncedAt || null
    });
  } catch (err) {
    console.error('load error:', err);
    return res.status(500).json({ error: err.message });
  }
}
