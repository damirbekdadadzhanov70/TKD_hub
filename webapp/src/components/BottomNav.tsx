import { useLocation, useNavigate } from 'react-router-dom';
import { useTelegram } from '../hooks/useTelegram';

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4" />
      <path d="M12 16h4" />
      <path d="M8 11h.01" />
      <path d="M8 16h.01" />
    </svg>
  );
}

function PodiumIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="14" width="6" height="8" rx="1" />
      <rect x="9" y="6" width="6" height="16" rx="1" />
      <rect x="17" y="10" width="6" height="12" rx="1" />
      <path d="M12 3v1" />
      <path d="M10.5 3.5 12 2l1.5 1.5" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

const tabs = [
  { path: '/', Icon: TrophyIcon, label: 'Tournaments' },
  { path: '/training', Icon: ClipboardIcon, label: 'Training' },
  { path: '/rating', Icon: PodiumIcon, label: 'Rating' },
  { path: '/profile', Icon: null, label: 'Profile' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { hapticFeedback, user: tgUser } = useTelegram();

  const handleNav = (path: string) => {
    hapticFeedback('light');
    navigate(path);
  };

  const photoUrl = tgUser?.photo_url;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 flex bg-bg-secondary border-t border-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {tabs.map((tab) => {
        const isActive =
          tab.path === '/'
            ? location.pathname === '/' || location.pathname.startsWith('/tournament')
            : location.pathname.startsWith(tab.path);

        const isProfile = tab.path === '/profile';

        return (
          <button
            key={tab.path}
            aria-label={tab.label}
            onClick={() => handleNav(tab.path)}
            className={`flex-1 flex items-center justify-center h-[60px] transition-all border-none bg-transparent cursor-pointer active:scale-95 ${
              isActive && !isProfile
                ? 'text-accent'
                : 'text-text-disabled hover:text-text-secondary'
            }`}
          >
            {isProfile ? (
              photoUrl ? (
                <img
                  src={photoUrl}
                  alt="Profile"
                  className={`w-8 h-8 -mt-1 rounded-full object-cover ${
                    isActive ? 'ring-2 ring-accent' : 'opacity-60'
                  }`}
                />
              ) : (
                <div className="-mt-1">
                  <UserIcon className={isActive ? 'text-accent' : undefined} />
                </div>
              )
            ) : (
              tab.Icon && <tab.Icon />
            )}
          </button>
        );
      })}
    </nav>
  );
}
