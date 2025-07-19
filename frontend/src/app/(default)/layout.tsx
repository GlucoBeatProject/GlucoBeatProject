import BottomNav from '@/components/BottomNav';
import SimpleHeader from '@/components/SimpleHeader';

export default function DefaultLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="pb-[96px] pt-[60px]">
      <SimpleHeader />
      <div className="px-4">{children}</div>
      <BottomNav />
    </div>
  );
}
