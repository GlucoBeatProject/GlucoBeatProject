import Link from 'next/link';

import DashboardContent from '@/components/dashboard/DashboardContent';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { parseISO, format } from 'date-fns';

export default async function Home() {
  const today = new Date();

  const initCgmData = await (
    await fetch(
      `http://127.0.0.1:4000/dashboard/cgm?start_date=${format(
        today,
        'yyyy-MM-dd'
      )}&end_date=${format(today, 'yyyy-MM-dd')}`
    )
  ).json();

  const initInsulinData = await (
    await fetch(
      `http://127.0.0.1:4000/dashboard/insulin?start_date=${format(
        today,
        'yyyy-MM-dd'
      )}&end_date=${format(today, 'yyyy-MM-dd')}`
    )
  ).json();

  const recentDia = await (
    await fetch(`http://127.0.0.1:4000/diagnosis?user_id=1`)
  ).json(); // [{ dia_id, diagnosis_preview, created_at }]

  const hasRecentDia = Array.isArray(recentDia) && recentDia.length > 0;

  // 최근 진단서 중 created_at으로 가장 최신 것 찾기
  let latestDiaId: number | null = null;

  if (hasRecentDia) {
    // ISO 문자열을 Date로 변환 후 비교
    const latestDia = recentDia.reduce((prev, curr) =>
      new Date(prev.created_at) > new Date(curr.created_at) ? prev : curr
    );
    latestDiaId = latestDia.dia_id;
  }

  // dia_id가 있으면 상세 API 호출해서 상세 정보 받기
  let diagnosisDetail: { dia_message?: string } = {};
  if (latestDiaId !== null) {
    diagnosisDetail = await (
      await fetch(`http://127.0.0.1:4000/diagnosis/${latestDiaId}`)
    ).json();
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      {/* 상단 3분할 카드 섹션 */}
      <section className="grid grid-cols-1 md:grid-cols-6 gap-5">
        {/* 최근 혈당 */}
        <Card className="md:col-span-2 h-full">
          <CardHeader>
            <CardTitle>최근 혈당</CardTitle>
            <CardDescription>오늘 기록된 가장 최근 혈당입니다.</CardDescription>
          </CardHeader>
          <CardContent className="mx-auto">
            {initCgmData.length > 0 ? (
              <div className="flex flex-col gap-2 items-center w-fit h-full justify-center">
                <p className="text-4xl sm:text-5xl font-bold text-primary">
                  {initCgmData[0].cgm_day.at(-1).cgm.toFixed(2)}{' '}
                  <span className="text-xs text-gray-400 md:text-sm">
                    mg/dL
                  </span>
                </p>
                <p className="text-xs text-gray-500 md:text-sm">
                  {initCgmData[0].cgm_day.at(-1).time}, G2P2C
                </p>
              </div>
            ) : (
              <span className="text-xs text-gray-400 text-center py-6">
                데이터가 존재하지 않습니다.
              </span>
            )}
          </CardContent>
        </Card>

        {/* 센서 상태 카드: 패치와 CGM 센서 위아래 분리 */}
        <div className="md:col-span-1 flex flex-col gap-5 min-h-[200px]">
          {/* "패치" 카드에 flex-1 추가 */}
          <Card className="flex-1 flex flex-col justify-between">
            <CardHeader>
              <CardTitle>패치</CardTitle>
            </CardHeader>
            <CardContent>
              <Switch id="patch-sensor" />
            </CardContent>
          </Card>

          {/* "CGM 센서" 카드에도 flex-1 추가 */}
          <Card className="flex-1 flex flex-col justify-between">
            <CardHeader>
              <CardTitle>CGM 센서</CardTitle>
            </CardHeader>
            <CardContent>
              <Switch id="cgm-sensor" defaultChecked />
            </CardContent>
          </Card>
        </div>

        {/* 의사의 진단 */}
        <Card className="md:col-span-3 h-full p-6">
          <CardHeader className="p-0 mb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg font-semibold text-gray-800">
                최근 의사의 진단
              </CardTitle>
              {/* <Link
                href="/diagnosis"
                className="text-sm px-3 py-1 bg-white text-primary rounded-md hover:underline"
              >
                나의 진단 내역 →
              </Link> */}
            </div>
            <CardDescription className="mt-2 text-sm text-gray-500">
              진단일:{' '}
              {format(parseISO(diagnosisDetail.created_at), 'yyyy년 M월 d일')}
            </CardDescription>
          </CardHeader>

          <CardContent className="text-sm leading-relaxed text-gray-800 whitespace-pre-line">
            {diagnosisDetail.dia_message || '진단 내역이 없습니다.'}
          </CardContent>

          <CardFooter className="justify-end p-0 mt-4">
            <Link
              href={`/diagnosis/${latestDiaId}`}
              className="text-sm text-primary hover:underline"
            >
              더보기
            </Link>
          </CardFooter>
        </Card>
      </section>

      {/* 그래프 섹션 */}
      <section className="flex flex-col gap-4">
        <h3 className="font-bold">그래프 한 눈에 보기</h3>
        <DashboardContent
          initCgmData={initCgmData}
          initInsulinData={initInsulinData}
        />
      </section>
    </div>
  );
}