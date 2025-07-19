import Header from '@/components/Header';
import SideBar from '@/components/SideBar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';

export default async function NewChatLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const res = await (await fetch('http://127.0.0.1:4000/chat')).json();

  return (
    <SidebarProvider>
      <SideBar chatData={res} />
      <div className="relative w-full">
        <Header type="chat" chatData={res} />
        <div className="lg:max-w-[720px] mx-auto">{children}</div>
      </div>
    </SidebarProvider>
  );
}