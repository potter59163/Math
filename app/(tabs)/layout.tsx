import { TabBar } from '@/components/app/TabBar';

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="min-h-dvh pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0 md:pl-56">
        {children}
      </div>
      <TabBar />
    </>
  );
}
