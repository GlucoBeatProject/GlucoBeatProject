'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IoCloseCircle } from 'react-icons/io5';
import { IoIosArrowDown } from 'react-icons/io';
import { PiSidebarSimple } from 'react-icons/pi';
import { TbReport } from 'react-icons/tb';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePathname } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { IoChatbubbleEllipsesOutline } from 'react-icons/io5';
import { IoBarChart } from 'react-icons/io5';
import { Button } from './ui/button';
import Image from 'next/image';
import { IoEllipsisHorizontalSharp } from 'react-icons/io5';
import { SidebarTrigger } from './ui/sidebar';

interface Props {
  type?: 'default' | 'chat';
  chatData?: { chat_id: number; chat_name: string }[];
}

function Header({ type = 'default', chatData }: Props) {
  const [title, setTitle] = useState('GlucoBeat');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();

  const handleCloseSidebar = () => {
    setIsSidebarOpen(false);
  };

  useEffect(() => {
    const path = pathname.split('/');
    if (chatData) {
      if (path.length > 2) {
        for (let item of chatData) {
          if (item.chat_id !== Number(path[2])) continue;
          setTitle(item.chat_name);
          break;
        }
      } else {
        setTitle('새 채팅');
      }
    }
  }, [pathname, chatData]);

  const handledChatDelete = async (id: string) => {
    const res = await fetch(`http://127.0.0.1:4000/chat/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      window.location.href = '/chat';
    } else {
      alert('채팅 삭제에 실패했습니다.');
    }
  };

  return (
    <header className="flex sticky top-0 bg-white">
      <div
        className={`h-[60px] w-full px-4 flex gap-1 items-center bg-white border-b border-gray-200 z-50 `}
      >
        {type === 'chat' && <SidebarTrigger />}

        {pathname === '/chat' ? <h3>{title}</h3> : null}
        {pathname.startsWith('/chat') && pathname !== '/chat' ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              asChild
              className="flex gap-1 items-center hover:bg-white/50 py-1 px-2 rounded-md hover:cursor-pointer"
            >
              <div>
                <h3>{title}</h3>
                <IoIosArrowDown />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-44" align="start">
              <DropdownMenuGroup>
                <DropdownMenuItem>즐겨찾기</DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem>이름 변경</DropdownMenuItem>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                      }}
                    >
                      삭제
                    </DropdownMenuItem>
                  </AlertDialogTrigger>

                  {/* 삭제 버튼 클릭 시 알럿창 */}
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        채팅을 삭제하시겠습니까?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        이 작업은 되돌릴 수 없습니다.
                        <br /> <b>{title}</b> 의 모든 채팅 기록이 서버에서
                        영구적으로 삭제됩니다.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>취소</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() =>
                          handledChatDelete(pathname.split('/')[2])
                        }
                      >
                        삭제
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </header>
  );
}

export default Header;
