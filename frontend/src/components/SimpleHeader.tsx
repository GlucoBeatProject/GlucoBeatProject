'use client';

import Link from 'next/link';
import { Button } from './ui/button';
import Image from 'next/image';
import dummyImg from '../../public/dummy_profile.jpg';
import logoImg from '../../public/real_logo.png';
import { useEffect, useState } from 'react';

function SimpleHeader() {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  const controlHeader = () => {
    if (window.scrollY > lastScrollY) {
      setIsVisible(false);
    } else {
      setIsVisible(true);
    }
    setLastScrollY(window.scrollY);
  };

  useEffect(() => {
    window.addEventListener('scroll', controlHeader);

    return () => {
      window.removeEventListener('scroll', controlHeader);
    };
  }, [lastScrollY]);

  return (
    <>
      {/* 상단 헤더 */}
      <header
        className={`fixed w-full h-[60px] px-4 flex sm:justify-between gap-1 items-center border-b border-gray-200 bg-white z-50 left-0
        transition-all duration-300 ${isVisible ? 'top-0' : '-top-[60px]'}`}
      >
        <button
          onClick={() => (window.location.href = '/')}
          className="flex gap-2 items-center font-bold hover:cursor-pointer"
        >
          <div className="w-10 h-10 relative">
            <Image src={logoImg} alt="GlucoBeat" fill />
          </div>
          <span className="sm:hidden">GlucoBeat</span>
        </button>

        <div className="hidden sm:flex gap-5 items-center">
          <Button variant={'ghost'}>
            <Link href={'/chat'}>채팅하기</Link>
          </Button>
          <Button variant={'ghost'}>
            <Link href={'/reports'}>리포트 보기</Link>
          </Button>
          <Button variant={'ghost'}>
            <Link href={'/diagnosis'}>나의 진단 내역</Link>
          </Button>
          <button className="relative w-10 h-10 cursor-pointer flex items-center justify-center rounded-full border-2 border-gluco-main overflow-hidden">
            <Link href={'/404'}>
              <Image src={dummyImg} alt="프로필 이미지" fill />
            </Link>
          </button>
        </div>
      </header>
    </>
  );
}

export default SimpleHeader;