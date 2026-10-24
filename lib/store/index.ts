import { IRoomStore } from './interface';
import { memoryRoomStore } from './memoryStore';
import { SupabaseRoomStore } from './supabaseStore';

let storeInstance: IRoomStore | null = null;

export function getRoomStore(): IRoomStore {
  if (storeInstance) return storeInstance;

  const provider = process.env.DATA_PROVIDER?.toLowerCase();
  const hasSupabaseEnv =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (!!process.env.SUPABASE_SERVICE_ROLE_KEY || !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (provider === 'supabase' && hasSupabaseEnv) {
    storeInstance = new SupabaseRoomStore();
  } else {
    // 默认或开发测试时使用内置本地极速实时引擎
    storeInstance = memoryRoomStore;
  }

  return storeInstance;
}

export function getCurrentStoreType(): 'local' | 'supabase' {
  const provider = process.env.DATA_PROVIDER?.toLowerCase();
  const hasSupabaseEnv =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (!!process.env.SUPABASE_SERVICE_ROLE_KEY || !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  return provider === 'supabase' && hasSupabaseEnv ? 'supabase' : 'local';
}

