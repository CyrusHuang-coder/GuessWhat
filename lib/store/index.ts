import { IRoomStore } from './interface';
import { memoryRoomStore } from './memoryStore';
import { SupabaseRoomStore } from './supabaseStore';
import { KvRoomStore } from './kvStore';

let storeInstance: IRoomStore | null = null;

export function getRoomStore(): IRoomStore {
  if (storeInstance) return storeInstance;

  const provider = process.env.DATA_PROVIDER?.toLowerCase();
  const hasKvEnv = !!(
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) ||
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  );
  const hasSupabaseEnv =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (!!process.env.SUPABASE_SERVICE_ROLE_KEY || !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (hasKvEnv || provider === 'kv' || provider === 'upstash') {
    storeInstance = new KvRoomStore();
  } else if (provider === 'supabase' && hasSupabaseEnv) {
    storeInstance = new SupabaseRoomStore();
  } else {
    // 默认或开发测试时使用内置本地极速实时引擎
    storeInstance = memoryRoomStore;
  }

  return storeInstance;
}

export function getCurrentStoreType(): 'local' | 'supabase' | 'kv' {
  const provider = process.env.DATA_PROVIDER?.toLowerCase();
  const hasKvEnv = !!(
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) ||
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  );
  const hasSupabaseEnv =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (!!process.env.SUPABASE_SERVICE_ROLE_KEY || !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (hasKvEnv || provider === 'kv' || provider === 'upstash') return 'kv';
  if (provider === 'supabase' && hasSupabaseEnv) return 'supabase';
  return 'local';
}

