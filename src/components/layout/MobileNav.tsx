import React from 'react';
import { useUIStore, MainView } from '../../stores/useUIStore';
import { Compass, Search, Library, FolderOpen, PieChart, Sparkles } from 'lucide-react';

export const MobileNav: React.FC = () => {
  const activeView = useUIStore((state) => state.activeView);
  const setActiveView = useUIStore((state) => state.setActiveView);
  const setAICompanionOpen = useUIStore((state) => state.setAICompanionOpen);

  const navItems: { id: MainView; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'home', label: 'Home', icon: Compass },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'library', label: 'Library', icon: Library },
    { id: 'studio', label: 'Studio', icon: FolderOpen },
    { id: 'insights', label: 'Insights', icon: PieChart },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 pb-safe bg-[#0d0c0b]/95 backdrop-blur-2xl border-t border-white/[0.08] select-none transition-all">
      <div className="flex items-center justify-around px-2 pt-1.5 pb-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`relative flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all duration-200 active:scale-95 ${
                isActive
                  ? 'text-[#f3c5a6]'
                  : 'text-[#8f867e] hover:text-[#fbf6f1]'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#f3c5a6] shadow-[0_0_6px_#f3c5a6]" />
                )}
              </div>
              <span className={`text-[10px] font-medium tracking-tight ${isActive ? 'font-semibold text-[#fbf6f1]' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}

        <button
          onClick={() => setAICompanionOpen(true)}
          className="relative flex flex-col items-center gap-1 py-1 px-3 rounded-2xl text-[#c084fc] hover:text-[#d8b4fe] transition-all duration-200 active:scale-95"
        >
          <div className="relative">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <span className="text-[10px] font-medium tracking-tight text-[#d8b4fe]">
            AURA AI
          </span>
        </button>
      </div>
    </nav>
  );
};
