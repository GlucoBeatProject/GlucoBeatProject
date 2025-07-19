'use client';

import { format } from 'date-fns';
import Link from 'next/link';
import { GoX } from 'react-icons/go';
import { ko } from 'date-fns/locale/ko';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useState } from 'react';

function ReportCard({ id, created_at, title }: any) {
  const [isOpen, setIsOpen] = useState(false);

  const handledReportDelete = async (id: string) => {
    const res = await fetch(`http://127.0.0.1:4000/reports/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      window.location.reload();
    } else {
      alert('리포트 삭제에 실패했습니다.');
    }
  };

  return (
    <Link
      key={id}
      href={`/report/${id}`}
      className="h-[107px] p-4 md:p-5 bg-white rounded-2xl border border-gray-200 shadow-sm hover:bg-gray-400/10"
    >
      <div className="flex justify-between">
        <p className="text-xs text-gray-400 mb-3">
          {format(new Date(created_at), 'yyyy.MM.dd (eee) HH:mm', {
            locale: ko,
          })}
        </p>

        <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
          <button
            className="hover:cursor-pointer p-1 -m-1"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsOpen(true);
            }}
          >
            <GoX size={20} color="#acacac" />
          </button>

          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
            <AlertDialogHeader>
              <AlertDialogTitle>리포트를 삭제하시겠습니까?</AlertDialogTitle>
              <AlertDialogDescription>
                이 작업은 되돌릴 수 없습니다.
                <br /> <b>{title}</b> 이(가) 서버에서 영구적으로 삭제됩니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction onClick={() => handledReportDelete(id)}>
                삭제
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <h6 className="font-bold md:text-xl truncate">{title}</h6>
    </Link>
  );
}

export default ReportCard;
