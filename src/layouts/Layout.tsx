import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import TrendingTopics from '@/components/TrendingTopics';

export default function Layout() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto flex">
        {/* Left: Sidebar */}
        <Sidebar />

        {/* Center: Main content */}
        <main className="flex-1 min-h-screen border-r border-gray-800 max-w-2xl lg:max-w-none">
          <Outlet />
        </main>

        {/* Right: Widgets */}
        <aside className="hidden xl:block w-80 2xl:w-96 px-4 py-2 sticky top-0 h-screen overflow-y-auto">
          <TrendingTopics />
        </aside>
      </div>
    </div>
  );
}
