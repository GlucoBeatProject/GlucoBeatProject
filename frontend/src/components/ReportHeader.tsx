'use client';

import { useRouter } from 'next/navigation';
import { GoChevronLeft } from 'react-icons/go';

interface Props {
  title: string;
}
function ReportHeader({ title }: Props) {
  const router = useRouter();
  return (
    <header className="fixed bg-white z-30 top-0 left-0 h-[60px] font-bold text-sm md:text-base flex items-center justify-center w-full">
      <button onClick={() => router.back()} className="hover:cursor-pointer">
        <GoChevronLeft size={24} className="absolute left-1 top-4" />
      </button>
      {title}
    </header>
  );
}

export default ReportHeader;
