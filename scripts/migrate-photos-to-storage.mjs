// One-time data migration: moves dish photos out of the `products.image_url` column (where
// they're stored as base64 data: URLs, embedded straight into every /api/products and
// /api/initial-data response) into a public Supabase Storage bucket, and rewrites each
// product's imageUrl to the resulting public URL.
//
// Why: those two endpoints were each ~2.4MB per request purely from embedded base64 photos,
// and /api/products is polled every 60s by every open manager/territorial session — this blew
// through Vercel's Fast Origin Transfer allowance. Storage URLs are small strings and get
// served (and cached) by Supabase's own CDN instead of re-transferring the same bytes from our
// serverless function on every single request.
//
// Safe by construction: each photo is uploaded and verified *before* the product row is
// updated, and only products whose imageUrl currently starts with "data:" are touched — nothing
// already using a real URL is touched, and no row is modified until its new photo is confirmed
// stored.
//
// Usage: node scripts/migrate-photos-to-storage.mjs [--dry-run]

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = 'product-photos';
const dryRun = process.argv.includes('--dry-run');

async function ensureBucket() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw error;
  if (buckets.some((b) => b.name === BUCKET)) {
    console.log(`Bucket "${BUCKET}" already exists.`);
    return;
  }
  if (dryRun) {
    console.log(`[dry-run] would create public bucket "${BUCKET}"`);
    return;
  }
  const { error: createErr } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: '5MB',
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  });
  if (createErr) throw createErr;
  console.log(`Created public bucket "${BUCKET}".`);
}

function parseDataUrl(dataUrl) {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!m) return null;
  const mime = m[1];
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  return { buffer: Buffer.from(m[2], 'base64'), mime, ext };
}

async function main() {
  await ensureBucket();

  const { data: products, error } = await supabase.from('products').select('id, name, image_url');
  if (error) throw error;

  const toMigrate = products.filter((p) => typeof p.image_url === 'string' && p.image_url.startsWith('data:'));
  console.log(`${products.length} products total, ${toMigrate.length} with an embedded base64 photo to migrate.`);

  let migrated = 0;
  let failed = 0;
  let totalBytesIn = 0;

  for (const p of toMigrate) {
    const parsed = parseDataUrl(p.image_url);
    if (!parsed) {
      console.warn(`  SKIP ${p.id} (${p.name}): couldn't parse data URL`);
      failed++;
      continue;
    }
    totalBytesIn += parsed.buffer.length;
    const path = `${p.id}.${parsed.ext}`;

    if (dryRun) {
      console.log(`  [dry-run] would upload ${path} (${Math.round(parsed.buffer.length / 1024)} KB) for "${p.name}"`);
      continue;
    }

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, parsed.buffer, { contentType: parsed.mime, upsert: true, cacheControl: '31536000' });
    if (uploadErr) {
      console.error(`  FAILED upload for ${p.id} (${p.name}):`, uploadErr.message);
      failed++;
      continue;
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = pub.publicUrl;

    // Only now, with the photo already confirmed stored, do we touch the product row.
    const { error: updateErr } = await supabase.from('products').update({ image_url: publicUrl }).eq('id', p.id);
    if (updateErr) {
      console.error(`  FAILED to update product row for ${p.id} (${p.name}) — photo IS uploaded at ${publicUrl}, but the row still points at the old base64:`, updateErr.message);
      failed++;
      continue;
    }

    console.log(`  OK ${p.id} (${p.name}) -> ${publicUrl}`);
    migrated++;
  }

  console.log(
    `\nDone. Migrated: ${migrated}, failed: ${failed}, skipped (already a URL): ${products.length - toMigrate.length}.` +
    (dryRun ? ' (dry run — nothing was actually changed)' : ` Freed ~${Math.round(totalBytesIn / 1024)} KB of base64 out of the products payload.`)
  );
}

main().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
