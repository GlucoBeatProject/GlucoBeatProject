'use client';

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import {
  IoBarChart,
  IoChatbubbleEllipsesOutline,
  IoEllipsisHorizontalSharp,
} from 'react-icons/io5';
import { TbReport } from 'react-icons/tb';
import { FaUserDoctor } from 'react-icons/fa6';

function SideBar({ chatData }: any) {
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
    <Sidebar>
      <SidebarHeader />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenuButton className="mb-3">
              <Link
                href="/chat"
                className="w-full flex gap-2 items-center px-2 py-3 cursor-pointer"
              >
                <IoChatbubbleEllipsesOutline size={16} />새 채팅
              </Link>
            </SidebarMenuButton>
            <SidebarMenuButton className="mb-3">
              <Link
                href="/"
                className="w-full px-2 py-3 cursor-pointer flex gap-2 items-center"
              >
                <IoBarChart size={16} />
                대시보드
              </Link>
            </SidebarMenuButton>
            <SidebarMenuButton className="mb-3">
              <Link
                href="/reports"
                className="w-full flex gap-2 items-center px-2 py-3 cursor-pointer"
              >
                <TbReport size={16} />
                심층 리포트
              </Link>
            </SidebarMenuButton>
            <SidebarMenuButton className="mb-3">
              <Link
                href="/diagnosis"
                className="w-full flex gap-2 items-center px-2 py-3 cursor-pointer"
              >
                <FaUserDoctor size={16} />
                나의 진단 내역
              </Link>
            </SidebarMenuButton>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel className="text-15px text-gray-600">
            채팅
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {chatData?.map(({ chat_id, chat_name }: any) => (
                <SidebarMenuItem key={chat_id}>
                  <SidebarMenuButton
                    asChild
                    className="p-3 flex justify-between items-center group"
                  >
                    <a href={`/chat/${chat_id}`}>
                      <span>{chat_name}</span>
                      <DropdownMenu key={chat_id}>
                        <DropdownMenuTrigger
                          asChild
                          className="flex gap-1 items-center hover:bg-white/50 py-1 px-2 rounded-md hover:cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                        >
                          <button className="p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-gray-200 transition-opacity duration-200">
                            <IoEllipsisHorizontalSharp className="text-gray-500" />
                          </button>
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
                                    event.stopPropagation();
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
                                    <br /> <b>{chat_name}</b> 의 모든 채팅
                                    기록이 서버에서 영구적으로 삭제됩니다.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>취소</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handledChatDelete(String(chat_id));
                                    }}
                                  >
                                    삭제
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  );
}

export default SideBar;