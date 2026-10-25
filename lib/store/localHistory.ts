export interface RecentRoomItem {
  code: string;
  myNickname: string;
  opponentNickname: string | null;
  role: 'host' | 'guest';
  roundNumber: number;
  status: 'waiting_player' | 'in_game' | 'ended';
  updatedAt: number;
}

export interface UserPreferences {
  defaultNickname: string;
  autoCopyInviteLink: boolean;
  hapticFeedback: boolean;
}

const RECENT_ROOMS_KEY = 'gw_recent_rooms';
const PREFS_KEY = 'gw_user_prefs';

export function savePlayerToken(code: string, token: string, nickname?: string) {
  if (typeof window === 'undefined') return;
  const uppercaseCode = code.toUpperCase();
  try {
    localStorage.setItem(`gw_token_${uppercaseCode}`, token);
    sessionStorage.setItem(`gw_token_${uppercaseCode}`, token);
    if (nickname) {
      localStorage.setItem(`gw_nick_${uppercaseCode}`, nickname);
      sessionStorage.setItem(`gw_nick_${uppercaseCode}`, nickname);
    }
  } catch (e) {
    // 忽略配额异常
  }
}

export function getPlayerToken(code: string): string {
  if (typeof window === 'undefined') return '';
  const uppercaseCode = code.toUpperCase();
  return (
    sessionStorage.getItem(`gw_token_${uppercaseCode}`) ||
    localStorage.getItem(`gw_token_${uppercaseCode}`) ||
    ''
  );
}

export function getSavedNickname(code: string): string {
  if (typeof window === 'undefined') return '';
  const uppercaseCode = code.toUpperCase();
  return (
    sessionStorage.getItem(`gw_nick_${uppercaseCode}`) ||
    localStorage.getItem(`gw_nick_${uppercaseCode}`) ||
    ''
  );
}

export function saveRecentRoom(item: RecentRoomItem) {
  if (typeof window === 'undefined') return;
  try {
    const list = getRecentRooms();
    const existingIndex = list.findIndex((r) => r.code.toUpperCase() === item.code.toUpperCase());

    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...item, updatedAt: Date.now() };
    } else {
      list.unshift({ ...item, updatedAt: Date.now() });
    }

    // 最多保留最近 15 个房间
    const trimmed = list.slice(0, 15);
    localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(trimmed));
  } catch (e) {
    // ignore
  }
}

export function getRecentRooms(): RecentRoomItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_ROOMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function removeRecentRoom(code: string) {
  if (typeof window === 'undefined') return;
  try {
    const uppercaseCode = code.toUpperCase();
    const list = getRecentRooms().filter((r) => r.code.toUpperCase() !== uppercaseCode);
    localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(list));
    localStorage.removeItem(`gw_token_${uppercaseCode}`);
    localStorage.removeItem(`gw_nick_${uppercaseCode}`);
    sessionStorage.removeItem(`gw_token_${uppercaseCode}`);
    sessionStorage.removeItem(`gw_nick_${uppercaseCode}`);
  } catch (e) {
    // ignore
  }
}

export function getUserPreferences(): UserPreferences {
  const defaultPrefs: UserPreferences = {
    defaultNickname: '',
    autoCopyInviteLink: true,
    hapticFeedback: true,
  };
  if (typeof window === 'undefined') return defaultPrefs;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return defaultPrefs;
    return { ...defaultPrefs, ...JSON.parse(raw) };
  } catch (e) {
    return defaultPrefs;
  }
}

export function saveUserPreferences(prefs: Partial<UserPreferences>) {
  if (typeof window === 'undefined') return;
  try {
    const current = getUserPreferences();
    const updated = { ...current, ...prefs };
    localStorage.setItem(PREFS_KEY, JSON.stringify(updated));
  } catch (e) {
    // ignore
  }
}
