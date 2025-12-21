import type { ReactNode } from 'react';

import { SettingsSidebar } from '@/features/settings/components/settings-sidebar';

type SettingsLayoutProps = {
  children: ReactNode;
};

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="lg:w-64">
        <SettingsSidebar />
      </div>
      <div className="flex-1 rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
        {children}
      </div>
    </div>
  );
}





