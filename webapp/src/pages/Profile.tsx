import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomSheet from '../components/BottomSheet';
import { useToast } from '../components/Toast';
import LoadingSpinner from '../components/LoadingSpinner';
import { useApi } from '../hooks/useApi';
import { useTelegram } from '../hooks/useTelegram';
import { useI18n } from '../i18n/I18nProvider';
import { CITIES } from '../constants/cities';
import {
  acceptAthleteRequest,
  approveRoleRequest,
  deleteMyAccount,
  deleteNotification,
  getCoachAthletes,
  verifyCoach,
  getCoachEntries,
  getMe,
  getMyCoach,
  getNotifications,
  getPendingAthletes,
  getProfileStats,
  getRoleRequests,
  getUnreadCount,
  markNotificationsRead,
  rejectAthleteRequest,
  rejectRoleRequest,
  requestCoachLink,
  searchCoaches,
  searchUsers,
  submitRoleRequest,
  switchRole,
  unlinkCoach,
  updateCoach,
  updateMe,
} from '../api/endpoints';
import {
  acceptMockAthleteRequest,
  approveMockRoleRequest,
  deleteMockAccount,
  deleteMockNotification,
  getMockNotificationsForRole,
  getMockUnreadCount,
  mockCoachAthletes,
  mockCoachEntries,
  mockCoachSearchResults,
  mockMarkNotificationsRead,
  mockMe,
  mockMyCoach,
  mockPendingAthletes,
  mockProfileStats,
  mockRoleRequests,
  rejectMockAthleteRequest,
  rejectMockRoleRequest,
  requestMockCoachLink,
  searchMockUsers,
  switchMockRole,
  unlinkMockCoach,
} from '../api/mock';
import type {
  AthleteUpdate,
  CoachAthlete,
  CoachEntry,
  CoachSearchResult,
  CoachUpdate,
  MeResponse,
  MyCoachLink,
  NotificationItem,
  PendingAthleteRequest,
  ProfileStats,
  RoleRequestItem,
  UserSearchItem,
} from '../types';

const ROLES: MeResponse['role'][] = ['athlete', 'coach', 'admin'];

const NAME_REGEX = /^[\p{L}\s-]*$/u;
function isValidName(v: string): boolean {
  return NAME_REGEX.test(v);
}

const WEIGHT_CATEGORIES = ['-54kg', '-58kg', '-63kg', '-68kg', '-74kg', '-80kg', '-87kg', '+87kg'];
const WEIGHT_M = ['54kg', '58kg', '63kg', '68kg', '74kg', '80kg', '87kg', '+87kg'];
const WEIGHT_F = ['46kg', '49kg', '53kg', '57kg', '62kg', '67kg', '73kg', '+73kg'];
const RANKS = ['Без разряда', '3 разряд', '2 разряд', '1 разряд', 'КМС', 'МС', 'МСМК', 'ЗМС'];

const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function daysInMonth(month: number, year: number): number {
  if (!month || !year) return 31;
  return new Date(year, month, 0).getDate();
}

function ChevronDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function RoleFormSelectSheet({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { hapticFeedback } = useTelegram();
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open && activeRef.current) {
      activeRef.current.scrollIntoView({ block: 'center' });
    }
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex-1 flex items-center justify-between bg-transparent border-b border-border text-[15px] py-2 outline-none cursor-pointer transition-colors hover:border-accent min-w-0"
      >
        <span className={selected ? 'text-text truncate' : 'text-text-disabled truncate'}>
          {selected ? selected.label : label}
        </span>
        <ChevronDown />
      </button>
      {open && (
        <BottomSheet onClose={() => setOpen(false)}>
          <div className="px-6 pt-2 pb-1">
            <h3 className="text-[17px] font-heading text-text-heading">{label}</h3>
          </div>
          <div className="overflow-y-auto px-2 pb-6" style={{ maxHeight: '50vh' }}>
            {options.map((opt) => (
              <button
                key={opt.value}
                ref={opt.value === value ? activeRef : undefined}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  hapticFeedback('light');
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-3 rounded-lg text-[15px] cursor-pointer transition-colors ${
                  opt.value === value
                    ? 'bg-accent text-white'
                    : 'text-text hover:bg-bg-secondary active:opacity-80'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </BottomSheet>
      )}
    </>
  );
}

function PillSelector({
  options,
  value,
  onChange,
  columns = 4,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  columns?: number;
}) {
  const { hapticFeedback } = useTelegram();
  return (
    <div className="flex flex-wrap gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => { onChange(opt); hapticFeedback('light'); }}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors ${
            value === opt
              ? 'bg-accent text-white border-accent'
              : 'bg-transparent text-text-disabled border-text-disabled hover:border-accent'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

/* ---- Icons ---- */

function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/* ---- Main ---- */

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function UserSearchSheet({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UserSearchItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const fetchUsers = useCallback(async (q: string) => {
    setSearchLoading(true);
    try {
      const data = await searchUsers(q || undefined);
      if (Array.isArray(data)) {
        setUsers(data);
      } else {
        setUsers(searchMockUsers(q));
      }
    } catch {
      setUsers(searchMockUsers(q));
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers('');
  }, [fetchUsers]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchUsers(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchUsers]);

  const ROLE_BADGE: Record<string, string> = {
    admin: 'bg-accent-light text-accent',
    coach: 'bg-blue-500/10 text-blue-500',
    athlete: 'bg-green-500/10 text-green-500',
    none: 'bg-bg-divider text-text-disabled',
  };

  return (
    <BottomSheet onClose={onClose}>
      <div className="flex items-center gap-3 p-4 pb-2 shrink-0">
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-bg-secondary border-none cursor-pointer text-text-secondary active:opacity-70 transition-opacity"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-heading text-text-heading">{t('profile.users')}</h2>
      </div>

      <div className="px-4 pb-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('profile.searchUsers')}
          autoFocus
          className="w-full bg-transparent border-b border-border text-[15px] text-text py-2 outline-none focus:border-accent transition-colors"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        {searchLoading && <LoadingSpinner />}

        {!searchLoading && users.length === 0 && (
          <p className="text-sm text-text-secondary text-center py-4">{t('profile.noUsersFound')}</p>
        )}

        {!searchLoading && users.map((u) => (
          <button
            key={u.id}
            onClick={() => {
              navigate(`/user/${u.id}`);
            }}
            className="w-full flex items-center gap-3 py-2.5 border-b border-dashed border-border bg-transparent border-x-0 border-t-0 cursor-pointer text-left active:opacity-70 hover:bg-bg-secondary transition-colors"
          >
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium shrink-0 bg-accent-light text-accent">
              {(u.full_name || '?').charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-medium text-text truncate">{u.full_name || u.id}</p>
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ROLE_BADGE[u.role] || ROLE_BADGE.none}`}>
                  {u.role}
                </span>
                {u.city && <span className="text-[12px] text-text-secondary">{u.city}</span>}
              </div>
            </div>
            <span className="text-text-disabled text-sm">→</span>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}

function SwipeNotificationItem({
  n,
  onDelete,
  onVerify,
}: {
  n: NotificationItem;
  onDelete: (id: string) => void;
  onVerify?: (n: NotificationItem) => void;
}) {
  const { t } = useI18n();
  const [offsetX, setOffsetX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const baseOffset = useRef(0);
  const locked = useRef(false);

  const DELETE_THRESHOLD = 80;
  const isVerifyRequest = n.type === 'coach_verify_request' && !!n.ref_id;

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    baseOffset.current = offsetX;
    locked.current = false;
    setSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swiping) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    if (!locked.current && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      locked.current = true;
      if (Math.abs(dy) > Math.abs(dx)) {
        setSwiping(false);
        return;
      }
    }

    const newOffset = Math.max(Math.min(baseOffset.current + dx, 0), -120);
    setOffsetX(newOffset);
  };

  const handleTouchEnd = () => {
    setSwiping(false);
    if (offsetX < -DELETE_THRESHOLD) {
      setOffsetX(-120);
    } else {
      setOffsetX(0);
    }
  };

  return (
    <div className="relative overflow-hidden">
      {/* Delete button behind */}
      <div className="absolute inset-y-0 right-0 flex items-center">
        <button
          onClick={() => onDelete(n.id)}
          className="h-full px-5 bg-rose-500 text-white text-xs font-medium border-none cursor-pointer active:bg-rose-600 transition-colors"
        >
          {t('common.delete')}
        </button>
      </div>
      {/* Swipeable content */}
      <div
        className={`relative bg-bg-secondary ${!n.read ? 'bg-accent-light/30' : ''}`}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: swiping ? 'none' : 'transform 0.2s ease-out',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="py-3 px-0 border-b border-dashed border-border">
          <p className="text-[14px] font-medium text-text">{n.title}</p>
          <p className="text-[13px] text-text-secondary mt-0.5">{n.body}</p>
          <div className="flex items-center justify-between mt-1">
            <p className="text-[11px] text-text-disabled">
              {new Date(n.created_at).toLocaleDateString()}
            </p>
            {isVerifyRequest && onVerify && (
              <button
                onClick={() => { setVerifying(true); onVerify(n); }}
                disabled={verifying}
                className="text-[12px] px-3 py-1 rounded-full bg-emerald-500 text-white font-medium border-none cursor-pointer active:opacity-80 hover:bg-emerald-600 transition-colors disabled:opacity-40"
              >
                {verifying ? '...' : 'Verify'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationsSheet({ isAdmin, onClose, onRead }: { isAdmin: boolean; onClose: () => void; onRead: () => void }) {
  const { t } = useI18n();
  const { hapticFeedback, hapticNotification } = useTelegram();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [nLoading, setNLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await getNotifications();
        if (Array.isArray(data)) {
          setNotifications(data);
        } else {
          setNotifications(getMockNotificationsForRole());
        }
      } catch {
        setNotifications(getMockNotificationsForRole());
      } finally {
        setNLoading(false);
      }
    })();
  }, []);

  const handleMarkRead = async () => {
    try {
      await markNotificationsRead();
      mockMarkNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      onRead();
      hapticFeedback('light');
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
      deleteMockNotification(id);
      const wasUnread = notifications.find((n) => n.id === id && !n.read);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (wasUnread) onRead();
      hapticNotification('success');
    } catch {
      hapticNotification('error');
    }
  };

  const handleVerify = async (n: NotificationItem) => {
    if (!n.ref_id) return;
    try {
      await verifyCoach(n.ref_id);
      // Mark this notification as read and update body
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === n.id
            ? { ...item, read: true, type: 'coach_verified_done', body: item.body.replace('ожидает верификации', 'верифицирован') }
            : item,
        ),
      );
      hapticNotification('success');
    } catch {
      hapticNotification('error');
    }
  };

  const hasUnread = notifications.some((n) => !n.read);

  return (
    <BottomSheet onClose={onClose}>
      <div className="flex items-center justify-between p-4 pb-2 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-bg-secondary border-none cursor-pointer text-text-secondary active:opacity-70 transition-opacity"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-lg font-heading text-text-heading">{t('profile.notifications')}</h2>
        </div>
        {hasUnread && (
          <button
            onClick={handleMarkRead}
            className="text-xs text-accent border-none bg-transparent cursor-pointer hover:underline"
          >
            {t('profile.markAllRead')}
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        {/* Admin: Role Requests section */}
        {isAdmin && <AdminRoleRequests />}

        {/* Notifications list */}
        {nLoading && <LoadingSpinner />}

        {!nLoading && notifications.length === 0 && !isAdmin && (
          <p className="text-sm text-text-secondary text-center py-4">{t('profile.noNotifications')}</p>
        )}

        {!nLoading && notifications.length > 0 && (
          <div className="mt-2">
            {isAdmin && notifications.length > 0 && (
              <p className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 mt-4">{t('profile.notifications')}</p>
            )}
            {notifications.map((n) => (
              <SwipeNotificationItem key={n.id} n={n} onDelete={handleDelete} onVerify={isAdmin ? handleVerify : undefined} />
            ))}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

export default function Profile() {
  const { user: tgUser } = useTelegram();
  const { t } = useI18n();
  const { data: me, loading, mutate } = useApi<MeResponse>(getMe, mockMe, []);
  const { data: stats } = useApi<ProfileStats>(getProfileStats, mockProfileStats, []);
  const [editing, setEditing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Fetch unread notifications count
  const { data: unreadData, mutate: mutateUnread } = useApi<{ count: number }>(
    getUnreadCount,
    { count: getMockUnreadCount() },
    [],
  );
  const unreadCount = unreadData?.count ?? 0;

  // Fetch role requests count for admin badge
  const { data: roleRequests } = useApi<RoleRequestItem[]>(
    getRoleRequests,
    mockRoleRequests,
    [],
  );
  const pendingRoleRequests = me?.is_admin ? (roleRequests?.length ?? 0) : 0;
  const badgeCount = unreadCount + pendingRoleRequests;

  if (loading) return <LoadingSpinner />;
  if (!me) return (
    <div className="flex flex-col items-center justify-center pt-20 px-4">
      <p className="text-sm text-text-secondary text-center">
        {t('common.couldNotLoad')}
      </p>
    </div>
  );

  const handleRoleChange = (newMe: MeResponse) => {
    mutate(newMe);
  };

  const isCoach = me.role === 'coach';
  const isAthlete = me.role === 'athlete';
  const isAdmin = me.role === 'admin';
  const displayName = isCoach
    ? (me.coach?.full_name || me.username || 'User')
    : (me.athlete?.full_name || me.username || 'User');
  const initial = displayName.charAt(0);
  const photoUrl = (isCoach ? me.coach?.photo_url : me.athlete?.photo_url) || tgUser?.photo_url;

  return (
    <div>
      {/* Profile header */}
      <div className="relative px-4 pt-3 pb-4">
        {/* Icons: search, notifications, settings — top right */}
        <div className="absolute top-3 right-4 flex flex-col items-center gap-2">
          <button
            aria-label={t('profile.searchUsers')}
            onClick={() => setShowUserSearch(true)}
            className="w-9 h-9 flex items-center justify-center rounded-full border-none bg-bg-secondary cursor-pointer text-text-secondary hover:text-accent active:opacity-70 transition-colors"
          >
            <SearchIcon />
          </button>
          <button
            aria-label={t('profile.notifications')}
            onClick={() => setShowNotifications(true)}
            className="relative w-9 h-9 flex items-center justify-center rounded-full border-none bg-bg-secondary cursor-pointer text-text-secondary hover:text-accent active:opacity-70 transition-colors"
          >
            <BellIcon />
            {badgeCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-bold px-1">
                {badgeCount}
              </span>
            )}
          </button>
          <button
            aria-label={t('profile.settings')}
            onClick={() => setShowSettings(true)}
            className="w-9 h-9 flex items-center justify-center rounded-full border-none bg-bg-secondary cursor-pointer text-text-secondary hover:text-accent active:opacity-70 transition-colors"
          >
            <GearIcon />
          </button>
        </div>

        {/* Avatar + name — centered, padded so text doesn't overlap icons */}
        <div className="flex flex-col items-center pt-1 px-12">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={displayName}
              className="w-24 h-24 rounded-full object-cover mb-3"
              style={{ border: '1px solid var(--color-accent)' }}
            />
          ) : (
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-medium bg-accent-light text-accent mb-3"
              style={{ border: '1px solid var(--color-accent)' }}
            >
              {initial}
            </div>
          )}
          <h1 className="text-[22px] font-heading text-text-heading text-center">
            {displayName}
          </h1>
          {isAthlete && me.athlete && (
            <p className="text-sm text-text-secondary mt-0.5">
              {me.athlete.sport_rank} · {me.athlete.weight_category}
            </p>
          )}
          {isCoach && me.coach && (
            <p className="text-sm text-text-secondary mt-0.5">
              {me.coach.qualification}
            </p>
          )}
          {isAdmin && (
            <p className="text-sm text-text-secondary mt-0.5">{t('profile.administrator')}</p>
          )}
        </div>
      </div>

      {/* Athlete profile */}
      {isAthlete && me.athlete && (
        <AthleteSection
          me={me}
          stats={stats}
          mutate={mutate}
          editing={editing}
          setEditing={setEditing}
        />
      )}

      {/* Coach profile */}
      {isCoach && me.coach && (
        <CoachSection me={me} mutate={mutate} />
      )}

      {/* Admin profile */}
      {isAdmin && (
        <div className="px-4">
          <p className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-3">{t('profile.information')}</p>
          <InfoRow label={t('profile.role')} value={t('profile.administrator')} />
          <InfoRow label="Users" value={`${stats?.users_count ?? 0} ${t('profile.usersCount')}`} />
          <InfoRow label={t('nav.tournaments')} value={`${stats?.tournaments_total ?? 0} ${t('profile.tournamentsCount')}`} />
        </div>
      )}

      {/* Settings */}
      {showSettings && (
        <SettingsSheet
          me={me}
          onClose={() => setShowSettings(false)}
          onRoleChange={handleRoleChange}
        />
      )}

      {/* User search sheet — for ALL roles */}
      {showUserSearch && (
        <UserSearchSheet onClose={() => setShowUserSearch(false)} />
      )}

      {/* Notifications sheet — for ALL roles */}
      {showNotifications && (
        <NotificationsSheet
          isAdmin={isAdmin}
          onClose={() => setShowNotifications(false)}
          onRead={() => mutateUnread({ count: 0 })}
        />
      )}
    </div>
  );
}

/* ---- Athlete Section ---- */

function AthleteSection({
  me,
  stats,
  mutate,
  editing,
  setEditing,
}: {
  me: MeResponse;
  stats: ProfileStats | null;
  mutate: (d: MeResponse) => void;
  editing: boolean;
  setEditing: (v: boolean) => void;
}) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const { hapticNotification } = useTelegram();
  const athlete = me.athlete!;
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showCoachSearch, setShowCoachSearch] = useState(false);
  const { data: myCoach, mutate: mutateCoach } = useApi<MyCoachLink | null>(
    getMyCoach,
    mockMyCoach,
    [],
  );
  const [unlinking, setUnlinking] = useState(false);

  const handleUnlink = async () => {
    if (!confirm(t('profile.unlinkCoachConfirm'))) return;
    setUnlinking(true);
    try {
      await unlinkCoach();
      hapticNotification('success');
      unlinkMockCoach();
      mutateCoach(null);
      showToast(t('profile.coachUnlinked'));
    } catch {
      hapticNotification('error');
      showToast(t('common.error'), 'error');
    } finally {
      setUnlinking(false);
    }
  };

  return (
    <>
      {/* Stats — 3 columns with vertical dividers */}
      <div className="flex items-center justify-center mx-4 mb-5 py-3 border-y border-border">
        <div className="flex-1 text-center">
          <p className="font-mono text-2xl text-text-heading">{athlete.rating_points}</p>
          <p className="text-[10px] uppercase tracking-[1.5px] text-text-disabled mt-0.5">{t('profile.ratingLabel')}</p>
        </div>
        <div className="w-px h-10 bg-border" />
        <div className="flex-1 text-center">
          <p className="font-mono text-2xl text-text-heading">{stats?.tournaments_count ?? 0}</p>
          <p className="text-[10px] uppercase tracking-[1.5px] text-text-disabled mt-0.5">{t('profile.tourneys')}</p>
        </div>
        <div className="w-px h-10 bg-border" />
        <div className="flex-1 text-center">
          <p className="font-mono text-2xl text-text-heading">{stats?.medals_count ?? 0}</p>
          <p className="text-[10px] uppercase tracking-[1.5px] text-text-disabled mt-0.5">{t('profile.medals')}</p>
        </div>
      </div>

      {/* Information */}
      <div className="px-4 mb-4">
        <p className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-3">{t('profile.information')}</p>
        <InfoRow label={t('profile.club')} value={athlete.club || '—'} />
        <InfoRow label={t('profile.city')} value={athlete.city} />
        <InfoRow label={t('profile.weightLabel')} value={`${athlete.current_weight} kg`} />
        <InfoRow label={t('profile.genderLabel')} value={athlete.gender === 'M' ? t('profile.male') : t('profile.female')} />
      </div>

      {/* My Coach */}
      <div className="px-4 mb-4">
        <p className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-3">{t('profile.myCoach')}</p>
        {myCoach ? (
          <div className="p-3 rounded-xl bg-bg-secondary">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium shrink-0 bg-accent-light text-accent">
                {myCoach.full_name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium text-text truncate">{myCoach.full_name}</p>
                <p className="text-[13px] text-text-secondary">{myCoach.club} · {myCoach.city}</p>
              </div>
            </div>
            <button
              onClick={handleUnlink}
              disabled={unlinking}
              className="mt-2 text-sm text-text-disabled border-none bg-transparent cursor-pointer p-0 active:opacity-70 hover:text-text-secondary"
            >
              {t('profile.unlinkCoach')}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowCoachSearch(true)}
            className="w-full py-3 rounded-lg text-sm font-medium cursor-pointer bg-transparent text-accent border border-accent hover:bg-accent-light active:bg-accent-light transition-colors"
          >
            {t('profile.findCoach')}
          </button>
        )}
      </div>

      {showCoachSearch && (
        <CoachSearchSheet
          onClose={() => setShowCoachSearch(false)}
          onLinked={(link) => {
            setShowCoachSearch(false);
            mutateCoach(link);
            showToast(t('profile.requestSentToCoach'));
          }}
        />
      )}

      {/* Tournament History — collapsible */}
      <div className="px-4 mb-4">
        <button
          onClick={() => setHistoryOpen(!historyOpen)}
          className="flex items-center gap-1.5 border-none bg-transparent cursor-pointer p-0 mb-2"
        >
          <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled">{t('profile.tournamentHistory')}</span>
          <ChevronIcon open={historyOpen} />
        </button>
        {historyOpen && (
          <div>
            {stats?.tournament_history && stats.tournament_history.length > 0 ? (
              stats.tournament_history.map((h, i) => (
                <TournamentHistoryRow key={i} place={h.place} name={h.tournament_name} date={h.tournament_date} />
              ))
            ) : (
              <p className="text-sm text-text-secondary">{t('profile.noResults')}</p>
            )}
          </div>
        )}
      </div>

      {/* Edit button — outlined */}
      <div className="px-4 mb-4">
        <button
          onClick={() => setEditing(true)}
          className="w-full py-3 rounded-lg text-sm font-medium cursor-pointer bg-transparent text-accent border border-accent hover:bg-accent-light active:bg-accent-light transition-colors"
        >
          {t('profile.editProfile')}
        </button>
      </div>

      {editing && (
        <EditProfileForm
          athlete={athlete}
          onClose={() => setEditing(false)}
          onSaved={(updated) => {
            setEditing(false);
            const newMe = {
              ...me,
              athlete: { ...me.athlete!, ...updated },
              // Sync name to coach profile
              coach: me.coach && updated.full_name !== undefined
                ? { ...me.coach, full_name: updated.full_name }
                : me.coach,
            };
            mutate(newMe);
          }}
        />
      )}
    </>
  );
}

/* ---- Coach Section ---- */

function CoachSection({ me, mutate }: { me: MeResponse; mutate: (d: MeResponse) => void }) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const { hapticNotification } = useTelegram();
  const coach = me.coach!;
  const navigate = useNavigate();
  const [showInvite, setShowInvite] = useState(false);
  const [editing, setEditing] = useState(false);
  const { data: rawAthletes, loading: loadingAthletes, refetch: refetchAthletes } = useApi<CoachAthlete[]>(
    getCoachAthletes,
    mockCoachAthletes,
    [],
  );
  const { data: rawEntries, loading: loadingEntries } = useApi<CoachEntry[]>(
    getCoachEntries,
    mockCoachEntries,
    [],
  );
  const { data: pendingRequests, refetch: refetchPending } = useApi<PendingAthleteRequest[]>(
    getPendingAthletes,
    mockPendingAthletes,
    [],
  );
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);

  const handleAcceptRequest = async (linkId: string) => {
    setProcessingRequest(linkId);
    try {
      await acceptAthleteRequest(linkId);
      hapticNotification('success');
      acceptMockAthleteRequest(linkId);
      showToast(t('profile.athleteRequestAccepted'));
      refetchPending(true);
      refetchAthletes(true);
    } catch {
      hapticNotification('error');
      showToast(t('common.error'), 'error');
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleRejectRequest = async (linkId: string) => {
    setProcessingRequest(linkId);
    try {
      await rejectAthleteRequest(linkId);
      hapticNotification('success');
      rejectMockAthleteRequest(linkId);
      showToast(t('profile.athleteRequestRejected'));
      refetchPending(true);
    } catch {
      hapticNotification('error');
      showToast(t('common.error'), 'error');
    } finally {
      setProcessingRequest(null);
    }
  };

  // Sync user's own athlete data in the coach's lists
  const myAthleteId = me.athlete?.id;
  const athletes = useMemo(() => {
    const list = rawAthletes || [];
    if (!myAthleteId || !me.athlete) return list;
    const a = me.athlete;
    return list.map((item) =>
      item.id === myAthleteId
        ? { ...item, full_name: a.full_name, weight_category: a.weight_category, sport_rank: a.sport_rank, rating_points: a.rating_points, club: a.club }
        : item,
    );
  }, [rawAthletes, myAthleteId, me.athlete]);

  const entries = useMemo(() => {
    const list = rawEntries || [];
    if (!myAthleteId || !me.athlete) return list;
    return list.map((item) =>
      item.athlete_id === myAthleteId
        ? { ...item, athlete_name: me.athlete!.full_name }
        : item,
    );
  }, [rawEntries, myAthleteId, me.athlete]);

  return (
    <>
      {/* Stats — 2 columns */}
      <div className="flex items-center justify-center mx-4 mb-5 py-3 border-y border-border">
        <div className="flex-1 text-center">
          <p className="font-mono text-2xl text-text-heading">{athletes?.length || 0}</p>
          <p className="text-[10px] uppercase tracking-[1.5px] text-text-disabled mt-0.5">{t('profile.athletesStat')}</p>
        </div>
        <div className="w-px h-10 bg-border" />
        <div className="flex-1 text-center">
          <p className="font-mono text-2xl text-text-heading">{entries?.length || 0}</p>
          <p className="text-[10px] uppercase tracking-[1.5px] text-text-disabled mt-0.5">{t('profile.activeEntries')}</p>
        </div>
      </div>

      {/* Information */}
      <div className="px-4 mb-4">
        <p className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-3">{t('profile.information')}</p>
        <InfoRow label={t('profile.club')} value={coach.club} />
        <InfoRow label={t('profile.city')} value={coach.city} />
        <InfoRow label={t('profile.sportRank')} value={coach.qualification} />
        <InfoRow label={t('profile.verifiedLabel')} value={coach.is_verified ? t('profile.verified') : t('profile.pendingVerification')} green={coach.is_verified} />
      </div>

      {/* Edit button — outlined */}
      <div className="px-4 mb-4">
        <button
          onClick={() => setEditing(true)}
          className="w-full py-3 rounded-lg text-sm font-medium cursor-pointer bg-transparent text-accent border border-accent hover:bg-accent-light active:bg-accent-light transition-colors"
        >
          {t('profile.editProfile')}
        </button>
      </div>

      {editing && (
        <EditCoachForm
          coach={coach}
          onClose={() => setEditing(false)}
          onSaved={(updated) => {
            setEditing(false);
            const newMe = {
              ...me,
              coach: { ...me.coach!, ...updated },
              // Sync name to athlete profile
              athlete: me.athlete && updated.full_name !== undefined
                ? { ...me.athlete, full_name: updated.full_name }
                : me.athlete,
            };
            mutate(newMe);
          }}
        />
      )}

      {/* Pending athlete requests */}
      {pendingRequests && pendingRequests.length > 0 && (
        <div className="px-4 mb-4">
          <p className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-3">{t('profile.pendingRequests')}</p>
          {pendingRequests.map((r) => (
            <div key={r.link_id} className="p-3 rounded-xl bg-bg-secondary mb-1.5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium shrink-0 bg-accent-light text-accent">
                  {r.full_name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium text-text truncate">{r.full_name}</p>
                  <p className="text-[13px] text-text-secondary">
                    {r.weight_category} · {r.sport_rank}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAcceptRequest(r.link_id)}
                  disabled={processingRequest === r.link_id}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold border-none cursor-pointer bg-accent text-accent-text active:opacity-80 disabled:opacity-40 transition-all"
                >
                  {t('profile.approve')}
                </button>
                <button
                  onClick={() => handleRejectRequest(r.link_id)}
                  disabled={processingRequest === r.link_id}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold border border-border bg-transparent cursor-pointer text-text active:opacity-80 disabled:opacity-40 transition-all"
                >
                  {t('profile.reject')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Athletes list */}
      <div className="px-4 mb-4">
        <p className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-3">{t('profile.athletes')}</p>
        {loadingAthletes ? (
          <LoadingSpinner />
        ) : !athletes || athletes.length === 0 ? (
          <p className="text-sm text-text-secondary">{t('profile.noAthletesYet')}</p>
        ) : (
          athletes.map((a, i) => (
            <div
              key={a.id}
              className={`flex items-center gap-3 py-3 ${i < athletes.length - 1 ? 'border-b border-dashed border-border' : ''}`}
            >
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium shrink-0 bg-accent-light text-accent">
                {a.full_name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium text-text truncate">{a.full_name}</p>
                <p className="text-[13px] text-text-secondary">
                  {a.weight_category} · {a.sport_rank} · <span className="text-accent">{a.rating_points} pts</span>
                </p>
              </div>
            </div>
          ))
        )}
        <button
          onClick={() => setShowInvite(true)}
          className="text-sm text-accent border-none bg-transparent cursor-pointer p-0 mt-2 active:opacity-70"
        >
          {t('profile.addAthlete')}
        </button>
      </div>

      {/* Active entries */}
      <div className="px-4 mb-4">
        <p className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-3">{t('profile.activeEntries')}</p>
        {loadingEntries ? (
          <LoadingSpinner />
        ) : !entries || entries.length === 0 ? (
          <p className="text-sm text-text-secondary">{t('profile.noActiveEntries')}</p>
        ) : (
          entries.map((e, i) => (
            <div
              key={e.id}
              className={`flex items-center justify-between py-3 ${i < entries.length - 1 ? 'border-b border-dashed border-border' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium text-text truncate">{e.tournament_name}</p>
                <p className="text-[13px] text-text-secondary">
                  {e.athlete_name} · {e.weight_category}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <EntryStatusBadge status={e.status} />
                <button
                  onClick={() => navigate(`/tournament/${e.tournament_id}`)}
                  className="text-[13px] text-accent cursor-pointer border-none bg-transparent p-0 active:opacity-70"
                >
                  {t('profile.editArrow')}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Invite athlete sheet */}
      {showInvite && (
        <BottomSheet onClose={() => setShowInvite(false)}>
          <div className="p-4 pt-5 text-center">
            <h2 className="text-lg font-heading text-text-heading mb-2">{t('profile.addAthleteTitle')}</h2>
            <p className="text-sm text-text-secondary mb-4">
              {t('profile.addAthleteDesc')}
            </p>
            <div className="bg-bg-secondary rounded-xl p-4 mb-4">
              <p className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-1">{t('profile.yourName')}</p>
              <p className="text-lg font-medium text-text">{coach.full_name}</p>
            </div>
            <p className="text-xs text-text-disabled">
              {t('profile.shareNameHint')}
            </p>
          </div>
        </BottomSheet>
      )}
    </>
  );
}

/* ---- Coach Search Sheet ---- */

function CoachSearchSheet({
  onClose,
  onLinked,
}: {
  onClose: () => void;
  onLinked: (link: MyCoachLink) => void;
}) {
  const { t } = useI18n();
  const { hapticNotification } = useTelegram();
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CoachSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const data = await searchCoaches(q);
      // Demo mode: searchCoaches returns {} when no API
      if (Array.isArray(data)) {
        setResults(data);
      } else {
        // Fallback to mock search
        setResults(
          mockCoachSearchResults.filter((c) =>
            c.full_name.toLowerCase().includes(q.toLowerCase()),
          ),
        );
      }
    } catch {
      setResults(
        mockCoachSearchResults.filter((c) =>
          c.full_name.toLowerCase().includes(q.toLowerCase()),
        ),
      );
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  const handleSelect = async (coach: CoachSearchResult) => {
    if (sending) return;
    setSending(true);
    try {
      const data = await requestCoachLink(coach.id);
      hapticNotification('success');
      // Demo mode: returns {} — use mock
      if (data && data.link_id) {
        onLinked(data);
      } else {
        onLinked(requestMockCoachLink(coach.id));
      }
    } catch {
      hapticNotification('error');
      showToast(t('common.error'), 'error');
      setSending(false);
    }
  };

  return (
    <BottomSheet onClose={onClose}>
      <div className="flex items-center gap-3 p-4 pb-2 shrink-0">
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-bg-secondary border-none cursor-pointer text-text-secondary active:opacity-70 transition-opacity"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-heading text-text-heading">{t('profile.findCoach')}</h2>
      </div>

      <div className="px-4 pb-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('profile.searchCoachPlaceholder')}
          autoFocus
          className="w-full bg-transparent border-b border-border text-[15px] text-text py-2 outline-none focus:border-accent transition-colors"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        {searching && <LoadingSpinner />}
        {!searching && query.length >= 2 && results.length === 0 && (
          <p className="text-sm text-text-secondary text-center py-4">{t('profile.noCoachesFound')}</p>
        )}
        {results.map((coach) => (
          <button
            key={coach.id}
            onClick={() => handleSelect(coach)}
            disabled={sending}
            className="w-full flex items-center gap-3 py-3 border-b border-dashed border-border bg-transparent border-x-0 border-t-0 cursor-pointer text-left active:opacity-70 disabled:opacity-40"
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium shrink-0 bg-accent-light text-accent">
              {coach.full_name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[15px] font-medium text-text truncate">{coach.full_name}</p>
                {coach.is_verified && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent-light text-accent font-medium">{t('profile.verifiedCoach')}</span>
                )}
              </div>
              <p className="text-[13px] text-text-secondary">{coach.club} · {coach.city}</p>
            </div>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}

/* ---- Entry Status Badge ---- */

const ENTRY_STATUS_CONFIG: Record<string, string> = {
  approved: 'bg-accent-light text-accent',
  pending: 'bg-bg-divider text-text-disabled',
  rejected: 'bg-rose-500/10 text-rose-500',
};

function EntryStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const labels: Record<string, string> = {
    approved: t('common.approved'),
    pending: t('common.pending'),
    rejected: t('common.rejected'),
  };
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${ENTRY_STATUS_CONFIG[status] || 'bg-bg-divider text-text-disabled'}`}>
      {labels[status] || status}
    </span>
  );
}

/* ---- Info Row ---- */

function InfoRow({ label, value, accent, green }: { label: string; value: string; accent?: boolean; green?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2">
      <span className="text-[11px] text-text-disabled">{label}</span>
      <span className={`text-[15px] ${green ? 'text-emerald-500' : accent ? 'text-accent' : 'text-text'}`}>{value}</span>
    </div>
  );
}

/* ---- Tournament History Row ---- */

const MEDAL_COLORS: Record<number, string> = {
  1: 'text-medal-gold',
  2: 'text-medal-silver',
  3: 'text-medal-bronze',
};

function TournamentHistoryRow({ place, name, date }: { place: number; name: string; date: string }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-dashed border-border">
      <span className={`font-mono text-base font-medium w-6 text-center ${MEDAL_COLORS[place] || 'text-text-disabled'}`}>
        {place}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text truncate">{name}</p>
        <p className="text-[11px] text-text-secondary">{date}</p>
      </div>
    </div>
  );
}

/* ---- Settings Sheet ---- */

function SettingsSheet({
  me,
  onClose,
  onRoleChange,
}: {
  me: MeResponse;
  onClose: () => void;
  onRoleChange: (newMe: MeResponse) => void;
}) {
  const { showToast } = useToast();
  const { hapticNotification } = useTelegram();
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showRoleRequestForm, setShowRoleRequestForm] = useState(false);

  const isAdmin = me.is_admin;
  const hasDualProfile = !!me.athlete && !!me.coach;

  const ROLE_LABELS: Record<MeResponse['role'], string> = {
    athlete: t('profile.roleAthlete'),
    coach: t('profile.roleCoach'),
    admin: t('profile.roleAdmin'),
    none: '',
  };
  const ROLE_DESCRIPTIONS: Record<MeResponse['role'], string> = {
    athlete: t('profile.roleAthleteDesc'),
    coach: t('profile.roleCoachDesc'),
    admin: t('profile.roleAdminDesc'),
    none: '',
  };

  const handleRoleSwitch = async (role: MeResponse['role']) => {
    if (role === me.role || role === 'none' || switching) return;
    setSwitching(true);
    try {
      const updated = await switchRole(role);
      hapticNotification('success');
      // Demo mode: switchRole returns {} as MeResponse, use mock fallback
      if (!updated.telegram_id) {
        onRoleChange(switchMockRole(role));
      } else {
        onRoleChange(updated);
      }
    } catch {
      hapticNotification('error');
      showToast(t('common.error'), 'error');
    } finally {
      setSwitching(false);
    }
  };

  // Determine which extra role the user can request
  const canRequestRole = !isAdmin && (
    (me.role === 'athlete' && !me.coach) || (me.role === 'coach' && !me.athlete)
  );
  const requestableRole = me.role === 'coach' ? 'athlete' : 'coach';

  if (showDeleteConfirm) {
    return (
      <BottomSheet onClose={onClose}>
        <div className="p-4 pt-5 text-center">
          <h2 className="text-lg font-heading text-text-heading mb-1">{t('profile.deleteAccountTitle')}</h2>
          <p className="text-sm text-text-secondary mb-5">
            {t('profile.deleteAccountDesc')}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 py-3 rounded-xl text-sm font-semibold border border-border bg-transparent cursor-pointer text-text active:opacity-80 transition-all"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={async () => {
                if (deleting) return;
                setDeleting(true);
                try {
                  await deleteMyAccount();
                  hapticNotification('success');
                  deleteMockAccount();
                  onClose();
                  showToast(t('profile.accountDeletionRequested'));
                  navigate('/onboarding');
                } catch {
                  hapticNotification('error');
                  showToast(t('common.error'), 'error');
                  setDeleting(false);
                }
              }}
              disabled={deleting}
              className="flex-1 py-3 rounded-xl text-sm font-semibold border-none cursor-pointer bg-rose-500 text-white active:opacity-80 disabled:opacity-40 transition-all"
            >
              {deleting ? t('common.deleting') : t('common.delete')}
            </button>
          </div>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet onClose={onClose}>
      <div className="flex items-center gap-3 p-4 pb-2 shrink-0">
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-bg-secondary border-none cursor-pointer text-text-secondary active:opacity-70 transition-opacity"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-heading text-text-heading">{t('profile.settings')}</h2>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        {/* Role */}
        <p className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 mt-3">{t('profile.role')}</p>

        {isAdmin ? (
          /* Admin: role switcher — only roles with existing profiles */
          <div className="space-y-1.5 mb-4">
            {ROLES.map((role) => {
              const hasProfile =
                role === 'admin' ||
                (role === 'athlete' && !!me.athlete) ||
                (role === 'coach' && !!me.coach);
              return (
                <button
                  key={role}
                  onClick={() => hasProfile && handleRoleSwitch(role)}
                  disabled={switching || !hasProfile}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border-none cursor-pointer text-left transition-all active:opacity-80 disabled:opacity-40 ${
                    me.role === role ? 'bg-accent text-white' : 'bg-bg-secondary text-text'
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium">{ROLE_LABELS[role]}</p>
                    <p className={`text-[11px] ${me.role === role ? 'text-white/70' : 'text-text-secondary'}`}>
                      {!hasProfile ? t('profile.noProfileForRole') : ROLE_DESCRIPTIONS[role]}
                    </p>
                  </div>
                  {me.role === role && <CheckIcon />}
                </button>
              );
            })}
          </div>
        ) : hasDualProfile ? (
          /* Regular user with both profiles: role switcher (athlete + coach only) */
          <div className="space-y-1.5 mb-4">
            {(['athlete', 'coach'] as const).map((role) => (
              <button
                key={role}
                onClick={() => handleRoleSwitch(role)}
                disabled={switching || me.role === role}
                className={`w-full flex items-center justify-between p-3 rounded-xl border-none cursor-pointer text-left transition-all active:opacity-80 disabled:cursor-default ${
                  me.role === role ? 'bg-accent text-white' : 'bg-bg-secondary text-text'
                }`}
              >
                <div>
                  <p className="text-sm font-medium">{ROLE_LABELS[role]}</p>
                  <p className={`text-[11px] ${me.role === role ? 'text-white/70' : 'text-text-secondary'}`}>
                    {ROLE_DESCRIPTIONS[role]}
                  </p>
                </div>
                {me.role === role && <CheckIcon />}
              </button>
            ))}
          </div>
        ) : (
          /* Regular user with single role: show current role, no switcher */
          <div className="mb-4 p-3 rounded-xl bg-bg-secondary">
            <p className="text-sm font-medium text-text">{ROLE_LABELS[me.role]}</p>
            <p className="text-[11px] text-text-secondary">{ROLE_DESCRIPTIONS[me.role]}</p>
          </div>
        )}

        {/* Language */}
        <p className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2">{t('profile.language')}</p>
        <div className="space-y-1 mb-4">
          {[{ value: 'ru' as const, label: 'Русский' }, { value: 'en' as const, label: 'English' }].map((l) => (
            <button
              key={l.value}
              onClick={() => setLang(l.value)}
              className="w-full flex items-center gap-3 py-2.5 border-none bg-transparent cursor-pointer text-left"
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                lang === l.value ? 'border-accent' : 'border-text-disabled'
              }`}>
                {lang === l.value && <div className="w-2.5 h-2.5 rounded-full bg-accent" />}
              </div>
              <span className="text-sm text-text">{l.label}</span>
            </button>
          ))}
        </div>

        {/* Account links */}
        <p className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2">{t('profile.account')}</p>
        <div className="mb-4">
          {canRequestRole && (
            <button
              onClick={() => setShowRoleRequestForm(true)}
              className="w-full flex items-center justify-between py-2.5 border-b border-border border-x-0 border-t-0 bg-transparent cursor-pointer text-left active:opacity-70"
            >
              <span className="text-sm text-text">
                {requestableRole === 'coach' ? t('profile.requestCoachRole') : t('profile.requestAthleteRole')}
              </span>
              <span className="text-text-disabled text-sm">→</span>
            </button>
          )}
          {[
            t('profile.exportData'),
            t('profile.about'),
            t('profile.support'),
          ].map((item) => (
            <button
              key={item}
              onClick={() => { onClose(); showToast(t('common.comingSoon')); }}
              className="w-full flex items-center justify-between py-2.5 border-b border-border border-x-0 border-t-0 bg-transparent cursor-pointer text-left active:opacity-70"
            >
              <span className="text-sm text-text">{item}</span>
              <span className="text-text-disabled text-sm">→</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full text-center text-sm text-text-disabled border-none bg-transparent cursor-pointer py-2 active:opacity-70"
        >
          {t('profile.deleteAccount')}
        </button>

        <p className="text-center font-mono text-[11px] text-text-disabled mt-4">v0.1.0</p>
      </div>

      {showRoleRequestForm && (
        <RoleRequestForm
          requestedRole={requestableRole}
          onClose={() => setShowRoleRequestForm(false)}
          onSubmitted={() => {
            setShowRoleRequestForm(false);
            showToast(t('profile.requestSent'));
          }}
        />
      )}
    </BottomSheet>
  );
}

/* ---- Admin Role Requests ---- */

function AdminRoleRequests() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const { hapticNotification } = useTelegram();
  const { data: requests, refetch } = useApi<RoleRequestItem[]>(
    getRoleRequests,
    mockRoleRequests,
    [],
  );
  const [processing, setProcessing] = useState<string | null>(null);

  const handleApprove = async (id: string) => {
    setProcessing(id);
    try {
      await approveRoleRequest(id);
      hapticNotification('success');
      approveMockRoleRequest(id);
      showToast(t('profile.roleRequestApproved'));
      refetch(true);
    } catch (err) {
      hapticNotification('error');
      showToast(err instanceof Error ? err.message : t('common.error'), 'error');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessing(id);
    try {
      await rejectRoleRequest(id);
      hapticNotification('success');
      rejectMockRoleRequest(id);
      showToast(t('profile.roleRequestRejected'));
      refetch(true);
    } catch {
      hapticNotification('error');
      showToast(t('common.error'), 'error');
    } finally {
      setProcessing(null);
    }
  };

  const ROLE_NAME: Record<string, string> = {
    coach: t('profile.roleCoach').toLowerCase(),
    athlete: t('profile.roleAthlete').toLowerCase(),
  };

  return (
    <div className="mb-4">
      <p className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2">{t('profile.roleRequests')}</p>
      {!requests || requests.length === 0 ? (
        <p className="text-sm text-text-secondary mb-2">{t('profile.noRoleRequests')}</p>
      ) : (
        requests.map((r) => {
          const d = r.data as Record<string, unknown> | null;
          return (
            <div key={r.id} className="p-3 rounded-xl bg-bg-secondary mb-1.5">
              <p className="text-sm text-text mb-1">
                <span className="font-medium">{r.username || r.user_id.slice(0, 8)}</span>
                {' '}{t('profile.wantsRole')}{' '}
                <span className="font-medium">{ROLE_NAME[r.requested_role] || r.requested_role}</span>
              </p>
              {d && (
                <div className="mb-2 space-y-0.5">
                  {d.full_name ? (
                    <p className="text-[12px] text-text-secondary">
                      <span className="text-text-disabled">{t('profile.roleRequestFullName')}:</span> {String(d.full_name)}
                    </p>
                  ) : null}
                  {d.date_of_birth ? (
                    <p className="text-[12px] text-text-secondary">
                      <span className="text-text-disabled">{t('profile.roleRequestDob')}:</span> {String(d.date_of_birth)}
                    </p>
                  ) : null}
                  {d.gender ? (
                    <p className="text-[12px] text-text-secondary">
                      <span className="text-text-disabled">{t('profile.roleRequestGender')}:</span> {d.gender === 'M' ? t('profile.male') : t('profile.female')}
                    </p>
                  ) : null}
                  {d.city ? (
                    <p className="text-[12px] text-text-secondary">
                      <span className="text-text-disabled">{t('profile.roleRequestCity')}:</span> {String(d.city)}
                    </p>
                  ) : null}
                  {d.club ? (
                    <p className="text-[12px] text-text-secondary">
                      <span className="text-text-disabled">{t('profile.roleRequestClub')}:</span> {String(d.club)}
                    </p>
                  ) : null}
                  {d.weight_category ? (
                    <p className="text-[12px] text-text-secondary">
                      <span className="text-text-disabled">{t('profile.roleRequestWeight')}:</span> {String(d.weight_category)}
                    </p>
                  ) : null}
                  {d.current_weight ? (
                    <p className="text-[12px] text-text-secondary">
                      <span className="text-text-disabled">{t('profile.roleRequestCurrentWeight')}:</span> {String(d.current_weight)} kg
                    </p>
                  ) : null}
                  {d.sport_rank ? (
                    <p className="text-[12px] text-text-secondary">
                      <span className="text-text-disabled">{t('profile.roleRequestSportRank')}:</span> {String(d.sport_rank)}
                    </p>
                  ) : null}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => handleApprove(r.id)}
                  disabled={processing === r.id}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold border-none cursor-pointer bg-accent text-accent-text active:opacity-80 disabled:opacity-40 transition-all"
                >
                  {t('profile.approve')}
                </button>
                <button
                  onClick={() => handleReject(r.id)}
                  disabled={processing === r.id}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold border border-border bg-transparent cursor-pointer text-text active:opacity-80 disabled:opacity-40 transition-all"
                >
                  {t('profile.reject')}
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

/* ---- Role Request Form ---- */

function RoleRequestForm({
  requestedRole,
  onClose,
  onSubmitted,
}: {
  requestedRole: 'athlete' | 'coach';
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { t, lang } = useI18n();
  const { hapticFeedback, hapticNotification } = useTelegram();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);

  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
  const [gender, setGender] = useState<'M' | 'F' | ''>('');
  const [rank, setRank] = useState('');
  const [city, setCity] = useState('');
  const [customCity, setCustomCity] = useState('');
  const [club, setClub] = useState('');
  const [weight, setWeight] = useState('');
  const [currentWeight, setCurrentWeight] = useState('');

  const clampDay = (day: string, month: string, year: string) => {
    if (day && month && year) {
      const maxDay = daysInMonth(Number(month), Number(year));
      if (Number(day) > maxDay) setDobDay(String(maxDay));
    }
  };
  const handleDobMonth = (m: string) => { setDobMonth(m); clampDay(dobDay, m, dobYear); };
  const handleDobYear = (y: string) => { setDobYear(y); clampDay(dobDay, dobMonth, y); };

  const effectiveCity = city === 'other' ? customCity.trim() : city;
  const dobValid = dobDay && dobMonth && dobYear;
  const lastNameValid = isValidName(lastName) && !!lastName.trim();
  const firstNameValid = isValidName(firstName) && !!firstName.trim();
  const lastNameError = lastName.length > 0 && !isValidName(lastName);
  const firstNameError = firstName.length > 0 && !isValidName(firstName);

  const isValid = requestedRole === 'athlete'
    ? lastNameValid && firstNameValid && dobValid && gender && weight && currentWeight && rank && effectiveCity
    : lastNameValid && firstNameValid && dobValid && gender && effectiveCity && club.trim();

  const handleSubmit = async () => {
    if (!isValid) return;
    setSaving(true);

    const fullName = `${lastName.trim()} ${firstName.trim()}`;
    const dateOfBirth = `${dobYear}-${dobMonth.padStart(2, '0')}-${dobDay.padStart(2, '0')}`;

    try {
      const data: Record<string, unknown> = {
        full_name: fullName,
        date_of_birth: dateOfBirth,
        gender,
        city: effectiveCity,
        club: club.trim() || null,
      };
      if (requestedRole === 'athlete') {
        data.weight_category = weight;
        data.current_weight = parseFloat(currentWeight);
        data.sport_rank = rank;
      }
      await submitRoleRequest({ requested_role: requestedRole, data });
      hapticNotification('success');
      onSubmitted();
    } catch {
      hapticNotification('error');
      showToast(t('common.error'), 'error');
      setSaving(false);
    }
  };

  const months = lang === 'ru' ? MONTHS_RU : MONTHS_EN;

  const yearOptions: { value: string; label: string }[] = [];
  for (let y = 2018; y >= 1960; y--) yearOptions.push({ value: String(y), label: String(y) });

  const maxDay = dobMonth && dobYear ? daysInMonth(Number(dobMonth), Number(dobYear)) : 31;
  const dayOptions = Array.from({ length: maxDay }, (_, i) => ({
    value: String(i + 1),
    label: String(i + 1),
  }));
  const monthOptions = months.map((m, i) => ({
    value: String(i + 1),
    label: m,
  }));

  const cityOptions = [
    ...CITIES.map((c) => ({ value: c, label: c })),
    { value: 'other', label: t('onboarding.otherCity') },
  ];

  const weightCategories = gender === 'F' ? WEIGHT_F : WEIGHT_M;

  return (
    <BottomSheet onClose={onClose}>
      <div className="flex items-center gap-3 p-4 pb-2 shrink-0">
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-bg-secondary border-none cursor-pointer text-text-secondary active:opacity-70 transition-opacity"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-heading text-text-heading">{t('profile.fillProfileData')}</h2>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2 space-y-4">
        {/* Last Name + First Name */}
        <div className="flex gap-3">
          <div className="flex-1">
            <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">{t('onboarding.lastName')}</span>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder={t('onboarding.enterLastName')}
              className={`w-full bg-transparent border-b text-[15px] text-text py-2 outline-none transition-colors placeholder:text-text-disabled ${
                lastNameError ? 'border-rose-500' : 'border-border focus:border-accent'
              }`}
            />
            {lastNameError && (
              <p className="text-[11px] text-rose-500 mt-1">{t('onboarding.nameInvalidChars')}</p>
            )}
          </div>
          <div className="flex-1">
            <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">{t('onboarding.firstName')}</span>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder={t('onboarding.enterFirstName')}
              className={`w-full bg-transparent border-b text-[15px] text-text py-2 outline-none transition-colors placeholder:text-text-disabled ${
                firstNameError ? 'border-rose-500' : 'border-border focus:border-accent'
              }`}
            />
            {firstNameError && (
              <p className="text-[11px] text-rose-500 mt-1">{t('onboarding.nameInvalidChars')}</p>
            )}
          </div>
        </div>

        {/* Date of Birth — 3 SelectSheet */}
        <div>
          <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">{t('onboarding.dateOfBirth')}</span>
          <div className="flex gap-2">
            <RoleFormSelectSheet
              label={t('onboarding.day')}
              value={dobDay}
              options={dayOptions}
              onChange={setDobDay}
            />
            <RoleFormSelectSheet
              label={t('onboarding.month')}
              value={dobMonth}
              options={monthOptions}
              onChange={handleDobMonth}
            />
            <RoleFormSelectSheet
              label={t('onboarding.year')}
              value={dobYear}
              options={yearOptions}
              onChange={handleDobYear}
            />
          </div>
        </div>

        {/* Gender — pill buttons */}
        <div>
          <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">{t('onboarding.gender')}</span>
          <div className="flex gap-2">
            {([['M', t('onboarding.male')], ['F', t('onboarding.female')]] as const).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => { setGender(val); hapticFeedback('light'); }}
                className={`flex-1 py-2.5 rounded-full text-sm font-medium border cursor-pointer transition-colors ${
                  gender === val
                    ? 'bg-accent text-white border-accent'
                    : 'bg-transparent text-text-disabled border-text-disabled hover:border-accent'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Athlete: weight category + current weight */}
        {requestedRole === 'athlete' && (
          <>
            <div>
              <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">{t('onboarding.weightCategory')}</span>
              <PillSelector options={weightCategories} value={weight} onChange={setWeight} />
            </div>

            <div>
              <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">{t('onboarding.currentWeight')}</span>
              <input
                type="number"
                step="0.1"
                min="0"
                max="300"
                value={currentWeight}
                onChange={(e) => setCurrentWeight(e.target.value)}
                placeholder="65.5"
                className="w-full bg-transparent border-b border-border text-[15px] text-text py-2 outline-none focus:border-accent transition-colors placeholder:text-text-disabled"
              />
            </div>
          </>
        )}

        {/* Sport Rank — athlete only */}
        {requestedRole === 'athlete' && (
          <div>
            <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">{t('onboarding.sportRank')}</span>
            <PillSelector options={RANKS} value={rank} onChange={setRank} columns={2} />
          </div>
        )}

        {/* City — SelectSheet + custom */}
        <div>
          <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">{t('onboarding.city')}</span>
          <RoleFormSelectSheet
            label={t('onboarding.selectCity')}
            value={city}
            options={cityOptions}
            onChange={setCity}
          />
          {city === 'other' && (
            <input
              value={customCity}
              onChange={(e) => setCustomCity(e.target.value)}
              placeholder={t('onboarding.enterCity')}
              className="w-full bg-transparent border-b border-border text-[15px] text-text py-2 mt-2 outline-none focus:border-accent transition-colors placeholder:text-text-disabled"
            />
          )}
        </div>

        {/* Club */}
        <div>
          <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">
            {t('onboarding.club')}
            {requestedRole === 'athlete' && <span className="normal-case tracking-normal text-text-disabled ml-1">({t('common.optional')})</span>}
          </span>
          <input
            value={club}
            onChange={(e) => setClub(e.target.value)}
            placeholder={t('onboarding.enterClub')}
            className="w-full bg-transparent border-b border-border text-[15px] text-text py-2 outline-none focus:border-accent transition-colors placeholder:text-text-disabled"
          />
        </div>
      </div>

      <div className="p-4 pt-2 shrink-0" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        <button
          onClick={handleSubmit}
          disabled={saving || !isValid}
          className="w-full py-3.5 rounded-lg text-sm font-semibold border-none cursor-pointer bg-accent text-accent-text disabled:opacity-40 active:opacity-80 transition-all"
        >
          {saving ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </BottomSheet>
  );
}

/* ---- Edit Profile Form ---- */

function EditProfileForm({
  athlete,
  onClose,
  onSaved,
}: {
  athlete: NonNullable<MeResponse['athlete']>;
  onClose: () => void;
  onSaved: (data: AthleteUpdate) => void;
}) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [form, setForm] = useState<AthleteUpdate>({
    full_name: athlete.full_name,
    weight_category: athlete.weight_category,
    current_weight: athlete.current_weight,
    sport_rank: athlete.sport_rank,
    city: athlete.city,
    club: athlete.club || '',
  });
  const { hapticNotification } = useTelegram();
  const [saving, setSaving] = useState(false);

  const hasChanges =
    form.full_name !== athlete.full_name ||
    form.weight_category !== athlete.weight_category ||
    form.current_weight !== athlete.current_weight ||
    form.sport_rank !== athlete.sport_rank ||
    form.city !== athlete.city ||
    form.club !== (athlete.club || '');

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await updateMe(form);
      hapticNotification('success');
      onSaved(form);
    } catch (err) {
      hapticNotification('error');
      showToast(err instanceof Error ? err.message : t('common.error'), 'error');
      setSaving(false);
    }
  };

  const update = (field: string, value: unknown) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <BottomSheet onClose={onClose}>
      <div className="flex items-center gap-3 p-4 pb-2 shrink-0">
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-bg-secondary border-none cursor-pointer text-text-secondary active:opacity-70 transition-opacity"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-heading text-text-heading">{t('profile.editProfile')}</h2>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2 space-y-4">
        <div>
          <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">{t('profile.fullName')}</span>
          <input
            value={form.full_name || ''}
            onChange={(e) => update('full_name', e.target.value)}
            className="w-full bg-transparent border-b border-border text-[15px] text-text py-2 outline-none focus:border-accent transition-colors"
          />
        </div>

        <div>
          <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">{t('profile.weightCategory')}</span>
          <div className="flex flex-wrap gap-1.5">
            {WEIGHT_CATEGORIES.map((w) => (
              <button
                key={w}
                onClick={() => update('weight_category', w)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors ${
                  form.weight_category === w
                    ? 'bg-accent text-white border-accent'
                    : 'bg-transparent text-text-disabled border-text-disabled'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">{t('profile.currentWeight')}</span>
          <input
            type="number"
            step="0.1"
            value={form.current_weight ?? ''}
            onChange={(e) => update('current_weight', parseFloat(e.target.value) || 0)}
            className="w-full bg-transparent border-b border-border text-[15px] text-text py-2 outline-none focus:border-accent transition-colors"
          />
        </div>

        <div>
          <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">{t('profile.sportRank')}</span>
          <div className="flex flex-wrap gap-1.5">
            {RANKS.map((r) => (
              <button
                key={r}
                onClick={() => update('sport_rank', r)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors ${
                  form.sport_rank === r
                    ? 'bg-accent text-white border-accent'
                    : 'bg-transparent text-text-disabled border-text-disabled'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">{t('profile.city')}</span>
          <select
            value={form.city || ''}
            onChange={(e) => update('city', e.target.value)}
            className="w-full bg-transparent border-b border-border text-[15px] text-text py-2 outline-none focus:border-accent transition-colors appearance-none"
          >
            {!CITIES.includes(form.city || '') && form.city && (
              <option value={form.city}>{form.city}</option>
            )}
            {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">{t('profile.club')}</span>
          <input
            value={form.club || ''}
            onChange={(e) => update('club', e.target.value)}
            className="w-full bg-transparent border-b border-border text-[15px] text-text py-2 outline-none focus:border-accent transition-colors"
          />
        </div>
      </div>

      <div className="p-4 pt-2 shrink-0" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        <button
          onClick={handleSubmit}
          disabled={saving || !hasChanges}
          className="w-full py-3.5 rounded-lg text-sm font-semibold border-none cursor-pointer bg-accent text-accent-text disabled:opacity-40 active:opacity-80 transition-all"
        >
          {saving ? t('common.saving') : t('profile.saveChanges')}
        </button>
      </div>
    </BottomSheet>
  );
}

/* ---- Edit Coach Form ---- */

function EditCoachForm({
  coach,
  onClose,
  onSaved,
}: {
  coach: NonNullable<MeResponse['coach']>;
  onClose: () => void;
  onSaved: (data: CoachUpdate) => void;
}) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [form, setForm] = useState<CoachUpdate>({
    full_name: coach.full_name,
    city: coach.city,
    club: coach.club,
    qualification: coach.qualification,
  });
  const { hapticNotification } = useTelegram();
  const [saving, setSaving] = useState(false);

  const hasChanges =
    form.full_name !== coach.full_name ||
    form.city !== coach.city ||
    form.club !== coach.club ||
    form.qualification !== coach.qualification;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await updateCoach(form);
      hapticNotification('success');
      onSaved(form);
    } catch (err) {
      hapticNotification('error');
      showToast(err instanceof Error ? err.message : t('common.error'), 'error');
      setSaving(false);
    }
  };

  const update = (field: string, value: unknown) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <BottomSheet onClose={onClose}>
      <div className="flex items-center gap-3 p-4 pb-2 shrink-0">
        <button
          onClick={onClose}
          aria-label="Close"
          className="w-8 h-8 flex items-center justify-center rounded-full bg-bg-secondary border-none cursor-pointer text-text-secondary active:opacity-70 transition-opacity"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-heading text-text-heading">{t('profile.editProfile')}</h2>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2 space-y-4">
        <div>
          <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">{t('profile.fullName')}</span>
          <input
            value={form.full_name || ''}
            onChange={(e) => update('full_name', e.target.value)}
            className="w-full bg-transparent border-b border-border text-[15px] text-text py-2 outline-none focus:border-accent transition-colors"
          />
        </div>

        <div>
          <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">{t('profile.city')}</span>
          <select
            value={form.city || ''}
            onChange={(e) => update('city', e.target.value)}
            className="w-full bg-transparent border-b border-border text-[15px] text-text py-2 outline-none focus:border-accent transition-colors appearance-none"
          >
            {!CITIES.includes(form.city || '') && form.city && (
              <option value={form.city}>{form.city}</option>
            )}
            {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">{t('profile.club')}</span>
          <input
            value={form.club || ''}
            onChange={(e) => update('club', e.target.value)}
            className="w-full bg-transparent border-b border-border text-[15px] text-text py-2 outline-none focus:border-accent transition-colors"
          />
        </div>

        <div>
          <span className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-2 block">{t('profile.sportRank')}</span>
          <div className="flex flex-wrap gap-1.5">
            {RANKS.map((r) => (
              <button
                key={r}
                onClick={() => update('qualification', r)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors ${
                  form.qualification === r
                    ? 'bg-accent text-white border-accent'
                    : 'bg-transparent text-text-disabled border-text-disabled'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 pt-2 shrink-0" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        <button
          onClick={handleSubmit}
          disabled={saving || !hasChanges}
          className="w-full py-3.5 rounded-lg text-sm font-semibold border-none cursor-pointer bg-accent text-accent-text disabled:opacity-40 active:opacity-80 transition-all"
        >
          {saving ? t('common.saving') : t('profile.saveChanges')}
        </button>
      </div>
    </BottomSheet>
  );
}
