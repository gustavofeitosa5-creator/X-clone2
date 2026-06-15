import { NavLink, useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';

interface NavItem {
  to: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current">
      {active
        ? <path d="M12 1.696L.622 8.807l1.06 1.696L3 9.679V19.5C3 20.881 4.119 22 5.5 22h4a1 1 0 001-1v-5h3v5a1 1 0 001 1h4c1.381 0 2.5-1.119 2.5-2.5V9.679l1.318.824 1.06-1.696L12 1.696z" />
        : <path d="M12 1.696L.622 8.807l1.06 1.696L3 9.679V19.5C3 20.881 4.119 22 5.5 22h13C19.881 22 21 20.881 21 19.5V9.679l1.318.824 1.06-1.696L12 1.696zM19 19.5c0 .276-.224.5-.5.5H14v-5a1 1 0 00-1-1h-2a1 1 0 00-1 1v5H5.5a.5.5 0 01-.5-.5V8.429l7-4.375 7 4.375V19.5z" />
      }
    </svg>
  );
}

function ExploreIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current">
      {active
        ? <path d="M10.25 3.75c-3.59 0-6.5 2.91-6.5 6.5s2.91 6.5 6.5 6.5c1.795 0 3.419-.726 4.596-1.904 1.178-1.177 1.904-2.801 1.904-4.596 0-3.59-2.91-6.5-6.5-6.5zm-8.5 6.5c0-4.694 3.806-8.5 8.5-8.5s8.5 3.806 8.5 8.5c0 1.986-.682 3.815-1.814 5.262l4.276 4.276-1.414 1.414-4.276-4.276A8.463 8.463 0 0110.25 18.75c-4.694 0-8.5-3.806-8.5-8.5z" />
        : <path d="M10.25 3.75c-3.59 0-6.5 2.91-6.5 6.5s2.91 6.5 6.5 6.5c1.795 0 3.419-.726 4.596-1.904 1.178-1.177 1.904-2.801 1.904-4.596 0-3.59-2.91-6.5-6.5-6.5zm-8.5 6.5c0-4.694 3.806-8.5 8.5-8.5s8.5 3.806 8.5 8.5c0 1.986-.682 3.815-1.814 5.262l4.276 4.276-1.414 1.414-4.276-4.276A8.463 8.463 0 0110.25 18.75c-4.694 0-8.5-3.806-8.5-8.5z" />
      }
    </svg>
  );
}

function BellIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current">
      {active
        ? <path d="M12 22.75c1.381 0 2.5-1.119 2.5-2.5h-5c0 1.381 1.119 2.5 2.5 2.5zm7.5-4.5H4.5c-.828 0-1.5-.672-1.5-1.5s.672-1.5 1.5-1.5h.5V11c0-3.09 2.09-5.674 4.951-6.406A2 2 0 0014 4.5a2 2 0 003.049-.906C19.91 5.326 22 7.91 22 11v4.25h.5c.828 0 1.5.672 1.5 1.5s-.672 1.5-1.5 1.5H19.5z" />
        : <path d="M12 22.75c1.381 0 2.5-1.119 2.5-2.5h-5c0 1.381 1.119 2.5 2.5 2.5zm7.5-4.5H4.5c-.828 0-1.5-.672-1.5-1.5s.672-1.5 1.5-1.5h.5V11c0-3.09 2.09-5.674 4.951-6.406A2 2 0 0014 4.5a2 2 0 003.049-.906C19.91 5.326 22 7.91 22 11v4.25h.5c.828 0 1.5.672 1.5 1.5s-.672 1.5-1.5 1.5H19.5zM10.059 5.094C7.553 5.546 5.5 7.836 5.5 11v4.25h13V11c0-3.164-2.053-5.454-4.559-5.906A3.96 3.96 0 0112 5.5a3.96 3.96 0 01-1.941-.406z" />
      }
    </svg>
  );
}

function MailIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current">
      {active
        ? <path d="M1.998 5.5c0-1.381 1.119-2.5 2.5-2.5h15c1.381 0 2.5 1.119 2.5 2.5v13c0 1.381-1.119 2.5-2.5 2.5h-15c-1.381 0-2.5-1.119-2.5-2.5v-13zm2.5-.5a.5.5 0 00-.5.5l9 6 9-6a.5.5 0 00-.5-.5h-17z" />
        : <path d="M1.998 5.5c0-1.381 1.119-2.5 2.5-2.5h15c1.381 0 2.5 1.119 2.5 2.5v13c0 1.381-1.119 2.5-2.5 2.5h-15c-1.381 0-2.5-1.119-2.5-2.5v-13zm2.5-.5a.5.5 0 00-.5.5l9 6 9-6a.5.5 0 00-.5-.5h-17zm-1 2.573V18.5a.5.5 0 00.5.5h17a.5.5 0 00.5-.5V7.573l-8.38 5.587a1 1 0 01-1.24 0L3.498 7.573z" />
      }
    </svg>
  );
}

function BookmarkIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current">
      {active
        ? <path d="M4 4.5C4 3.119 5.119 2 6.5 2h11C18.881 2 20 3.119 20 4.5v18.793l-8-3.784-8 3.784V4.5z" />
        : <path d="M4 4.5C4 3.119 5.119 2 6.5 2h11C18.881 2 20 3.119 20 4.5v18.793l-8-3.784-8 3.784V4.5zM6.5 4a.5.5 0 00-.5.5V19.21l6-2.838 6 2.838V4.5a.5.5 0 00-.5-.5h-11z" />
      }
    </svg>
  );
}

function UserIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current">
      {active
        ? <path d="M5.651 19h12.698c-.337-1.8-1.023-3.21-1.945-4.19C15.318 13.65 13.838 13 12 13s-3.317.65-4.404 1.81c-.922.98-1.608 2.39-1.945 4.19zm.486-5.56C7.627 11.85 9.648 11 12 11s4.373.85 5.863 2.44c1.477 1.58 2.366 3.8 2.632 6.46l.11 1.1H3.395l.11-1.1c.266-2.66 1.155-4.88 2.632-6.46zM12 4a2 2 0 100 4 2 2 0 000-4zm-4 2a4 4 0 118 0 4 4 0 01-8 0z" />
        : <path d="M5.651 19h12.698c-.337-1.8-1.023-3.21-1.945-4.19C15.318 13.65 13.838 13 12 13s-3.317.65-4.404 1.81c-.922.98-1.608 2.39-1.945 4.19zm.486-5.56C7.627 11.85 9.648 11 12 11s4.373.85 5.863 2.44c1.477 1.58 2.366 3.8 2.632 6.46l.11 1.1H3.395l.11-1.1c.266-2.66 1.155-4.88 2.632-6.46zM12 4a2 2 0 100 4 2 2 0 000-4zm-4 2a4 4 0 118 0 4 4 0 01-8 0z" />
      }
    </svg>
  );
}

function SettingsIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current">
      {active
        ? <path d="M10.54 1.75h2.92l1.57 2.36c.144.217.376.365.639.396l2.756.33 2.06 2.06-.33 2.757c-.03.263.18.494.394.638l2.36 1.57v2.92l-2.36 1.57c-.217.145-.365.376-.395.639l-.33 2.756-2.06 2.06-2.757-.33c-.263-.03-.494.18-.638.394l-1.57 2.36h-2.92l-1.57-2.36c-.144-.217-.376-.365-.639-.395l-2.756-.33-2.06-2.06.33-2.757c.03-.263-.18-.494-.394-.638L1.75 13.46v-2.92l2.36-1.57c.217-.144.365-.376.395-.639l.33-2.756 2.06-2.06 2.757.33c.263.03.494-.18.638-.394l1.57-2.36zm1.46 4.5a6 6 0 100 12 6 6 0 000-12z" />
        : <path d="M10.54 1.75h2.92l1.57 2.36c.144.217.376.365.639.396l2.756.33 2.06 2.06-.33 2.757c-.03.263.18.494.394.638l2.36 1.57v2.92l-2.36 1.57c-.217.145-.365.376-.395.639l-.33 2.756-2.06 2.06-2.757-.33c-.263-.03-.494.18-.638.394l-1.57 2.36h-2.92l-1.57-2.36c-.144-.217-.376-.365-.639-.395l-2.756-.33-2.06-2.06.33-2.757c.03-.263-.18-.494-.394-.638L1.75 13.46v-2.92l2.36-1.57c.217-.144.365-.376.395-.639l.33-2.756 2.06-2.06 2.757.33c.263.03.494-.18.638-.394l1.57-2.36zm1.46 4.5a6 6 0 100 12 6 6 0 000-12zm-4 6a4 4 0 118 0 4 4 0 01-8 0z" />
      }
    </svg>
  );
}

export default function Sidebar() {
  const profile = useStore((s) => s.profile);
  const unreadCount = useStore((s) => s.unreadCount);
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navItems: NavItem[] = [
    { to: '/home', label: 'Início', icon: (a) => <HomeIcon active={a} /> },
    { to: '/explore', label: 'Explorar', icon: (a) => <ExploreIcon active={a} /> },
    {
      to: '/notifications',
      label: 'Notificações',
      icon: (a) => (
        <div className="relative">
          <BellIcon active={a} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
      ),
    },
    { to: '/messages', label: 'Mensagens', icon: (a) => <MailIcon active={a} /> },
    { to: '/bookmarks', label: 'Salvos', icon: (a) => <BookmarkIcon active={a} /> },
    {
      to: `/profile/${profile?.username ?? ''}`,
      label: 'Perfil',
      icon: (a) => <UserIcon active={a} />,
    },
    { to: '/settings', label: 'Configurações', icon: (a) => <SettingsIcon active={a} /> },
  ];

  async function handleSignOut() {
    await signOut();
    navigate('/auth');
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col h-screen sticky top-0 w-72 xl:w-80 px-3 py-2 border-r border-gray-800 overflow-y-auto">
        {/* Logo */}
        <NavLink to="/home" className="p-3 hover:bg-gray-900 rounded-full w-fit transition-colors mb-1">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="w-8 h-8 text-white fill-current">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.261 5.636L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
          </svg>
        </NavLink>

        {/* Nav items */}
        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-4 px-3 py-3 rounded-full transition-colors hover:bg-gray-900 text-white font-medium text-lg w-fit xl:w-full ${
                  isActive ? 'font-bold' : ''
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {item.icon(isActive)}
                  <span className="hidden xl:block">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}

          {/* Post button */}
          <button
            onClick={() => navigate('/home')}
            className="mt-4 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-full py-3 px-6 transition-colors w-fit xl:w-full text-center"
          >
            <span className="hidden xl:block">Postar</span>
            <span className="xl:hidden">
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                <path d="M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2h6z" />
              </svg>
            </span>
          </button>
        </nav>

        {/* User card */}
        {profile && (
          <div className="relative mt-auto mb-3">
            {showUserMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-black border border-gray-700 rounded-2xl shadow-2xl py-2 z-50">
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-4 py-3 text-white hover:bg-gray-900 transition-colors font-bold"
                >
                  Sair de @{profile.username}
                </button>
                <NavLink
                  to="/settings"
                  onClick={() => setShowUserMenu(false)}
                  className="block w-full text-left px-4 py-3 text-white hover:bg-gray-900 transition-colors"
                >
                  Configurações
                </NavLink>
              </div>
            )}
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 w-full p-3 hover:bg-gray-900 rounded-full transition-colors text-left"
            >
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name ?? profile.username}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">
                    {(profile.display_name ?? profile.username).charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="hidden xl:block flex-1 min-w-0">
                <p className="text-white font-bold text-sm truncate">
                  {profile.display_name ?? profile.username}
                </p>
                <p className="text-gray-500 text-sm truncate">@{profile.username}</p>
              </div>
              <span className="hidden xl:block text-gray-500 ml-auto">···</span>
            </button>
          </div>
        )}
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 z-40 flex items-center justify-around px-4 py-2">
        {navItems.slice(0, 5).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `p-2 rounded-full transition-colors ${isActive ? 'text-white' : 'text-gray-500'}`
            }
          >
            {({ isActive }) => item.icon(isActive)}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
