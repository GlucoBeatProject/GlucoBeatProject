import { BsChatDotsFill } from 'react-icons/bs';
import { IoBarChart } from 'react-icons/io5';
import { FaUser } from 'react-icons/fa';
import { TbReport } from 'react-icons/tb';
import Link from 'next/link';

async function BottomNav() {
  return (
    <div className="h-[76px] w-full fixed left-0 bottom-0 sm:hidden">
      <nav className="text-xs mx-auto max-w-[640px] h-[76px] w-full bg-white bottom-shadow rounded-t-2xl flex justify-between py-4 px-6">
        <button className="w-11 h-11 cursor-pointer flex items-center justify-center">
          <Link
            href={'/'}
            className="text-primary flex flex-col items-center gap-2"
          >
            <IoBarChart size={24} fill="#fb2c36" />
            <p>대시보드</p>
          </Link>
        </button>
        <button className="w-11 h-11 cursor-pointer flex items-center justify-center">
          <Link
            href={'/chat'}
            className="text-[#acacac] flex flex-col items-center gap-2"
          >
            <BsChatDotsFill size={24} fill="#acacac" />
            <p>채팅</p>
          </Link>
        </button>
        <button className="w-11 h-11 cursor-pointer flex items-center justify-center">
          <Link
            href={'/reports'}
            className="text-[#acacac] flex flex-col items-center gap-2"
          >
            <TbReport size={24} stroke="#acacac" />
            <p>리포트</p>
          </Link>
        </button>

        <button className="relative w-11 h-11 cursor-pointer flex items-center justify-center">
          <Link
            href={'/404'}
            className="text-[#acacac] flex flex-col items-center gap-2"
          >
            <FaUser size={24} fill="#acacac" />
            <p>내정보</p>
          </Link>
        </button>
      </nav>
    </div>
  );
}

export default BottomNav;
