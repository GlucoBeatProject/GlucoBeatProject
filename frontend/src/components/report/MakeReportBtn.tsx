'use client';

import { useRouter } from 'next/navigation';
import { Button } from '../ui/button';
import { useState } from 'react';
import { SyncLoader } from 'react-spinners';

function MakeReportBtn() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleReportClick = async () => {
    setIsLoading(true);
    const res = await fetch(`http://127.0.0.1:4000/reports`, {
      method: 'POST',
    });
    if (res.ok) {
      const data = await res.json();
      router.push(`/report/${data.new_report_id}`);
    }
    setIsLoading(false);
  };
  return (
    <>
      <div className="w-full fixed left-0 bottom-0 px-4 flex justify-center pb-9">
        <Button
          variant={'default'}
          className="w-full h-[48px] font-bold md:max-w-[720px] hover:cursor-pointer"
          onClick={handleReportClick}
          disabled={isLoading}
        >
          새로운 리포트 생성하기
        </Button>
      </div>
      {isLoading ? (
        <div className="w-dvw h-dvh text-white bg-black/30 fixed top-0 left-0 z-50 flex flex-col gap-6 items-center justify-center">
          <SyncLoader size={8} color="#fff" speedMultiplier={0.6} />
          <p className="text-center">
            리포트를 생성 중입니다.
            <br />
            잠시만 기다려주세요!
            <br />
            <span className="text-xs">(1분 이상 소요됩니다.)</span>
          </p>
        </div>
      ) : null}
    </>
  );
}

export default MakeReportBtn;
