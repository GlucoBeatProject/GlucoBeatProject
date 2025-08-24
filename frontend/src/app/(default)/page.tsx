import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { CGM_MAX, CGM_MIN } from '@/const/cgm';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const DashboardContent = dynamic(
  () => import('@/components/dashboard/DashboardContent')
);
const DiaSection = dynamic(() => import('./_components/DiaSection'));
const ReportSection = dynamic(() => import('./_components/ReportSection'));

export default async function Home() {
  // const today = new Date();
  const today = '2025-07-21';
  const formatedDay = format(today, 'yyyy-MM-dd');

  //해당 데이터 전체는 DashboardContent용
  //내 상태 확인 section에서는 최신 데이터만 필요하므로 최신 데이터 get API가 추가되는 것이 가장 효율적인 최적화 방법
  const [initCgmData, initInsulinData] = await Promise.all([
    fetch(
      `http://127.0.0.1:4000/dashboard/cgm?start_date=${formatedDay}&end_date=${formatedDay}`,
      { next: { revalidate: 60 * 10 } }
    ).then((res) => res.json()),
    fetch(
      `http://127.0.0.1:4000/dashboard/insulin?start_date=${formatedDay}&end_date=${formatedDay}`,
      { next: { revalidate: 60 * 10 } }
    ).then((res) => res.json()),
  ]);

  const recentCgm = initCgmData[initCgmData.length - 1]?.cgm_day.at(-1).cgm;
  const isDangerState = recentCgm > CGM_MAX || recentCgm < CGM_MIN;

  return (
    <main className="mt-4 lg:mt-6 flex flex-col gap-6">
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:gap-5">
        <section className="flex flex-col gap-5">
          <h3 className="font-bold">내 상태 확인하기</h3>
          <Card>
            <CardHeader>
              <CardTitle>최근 혈당 수치</CardTitle>
              <CardDescription>
                오늘 기록된 가장 최근 혈당입니다.
              </CardDescription>
              {isDangerState ? (
                <div className="py-3 px-4 rounded-md bg-primary/15 text-primary font-bold">
                  ⚠️ 현재 {recentCgm > CGM_MAX ? '고' : '저'}
                  혈당 상태입니다.
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="mx-auto">
              {initCgmData.length > 0 ? (
                <div className="flex flex-col gap-2 items-center w-fit h-full justify-center">
                  <p
                    className={`text-4xl sm:text-5xl font-bold ${
                      isDangerState ? 'text-primary' : 'text-green-600'
                    }`}
                  >
                    {recentCgm.toFixed(2)}{' '}
                    <span className="text-xs text-gray-400 md:text-sm">
                      mg/dL
                    </span>
                  </p>
                  <p className="text-xs text-gray-500 md:text-sm">
                    {initCgmData[initCgmData.length - 1].cgm_day.at(-1).time}
                  </p>
                </div>
              ) : (
                <span className="text-xs text-gray-400 text-center py-6">
                  데이터가 존재하지 않습니다.
                </span>
              )}
            </CardContent>
          </Card>
          <div className="grid grid-cols-3 gap-5">
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>최근 인슐린 주입</CardTitle>
                <CardDescription>
                  오늘 기록된 가장 최근 인슐린 주입량입니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="mx-auto">
                {initCgmData.length > 0 ? (
                  <div className="flex flex-col gap-2 items-center w-fit h-full justify-center">
                    <p className="text-3xl font-bold">
                      {initInsulinData[initInsulinData.length - 1].insulin_day
                        .at(-1)
                        .insulin.toFixed(6)}{' '}
                      <span className="text-xs text-gray-400 md:text-sm">
                        U
                      </span>
                    </p>
                    <p className="text-3xl font-bold">
                      {
                        initInsulinData[
                          initInsulinData.length - 1
                        ].insulin_day.at(-1).algorithm
                      }{' '}
                      <span className="text-xs text-gray-400 md:text-sm">
                        알고리즘
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 md:text-sm">
                      {
                        initInsulinData[initCgmData.length - 1].insulin_day.at(
                          -1
                        ).time
                      }
                    </p>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 text-center py-6">
                    데이터가 존재하지 않습니다.
                  </span>
                )}
              </CardContent>
            </Card>
            <div className="flex flex-col gap-5 ">
              <Card className="flex flex-col justify-between">
                <CardHeader>
                  <CardTitle>패치</CardTitle>
                </CardHeader>
                <CardContent>
                  <Switch id="patch-sensor" />
                </CardContent>
              </Card>

              <Card className="flex flex-col justify-between">
                <CardHeader>
                  <CardTitle>CGM 센서</CardTitle>
                </CardHeader>
                <CardContent>
                  <Switch id="cgm-sensor" defaultChecked />
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* 그래프 섹션 */}
        <section className="flex flex-col gap-4">
          <h3 className="font-bold">그래프 한 눈에 보기</h3>
          <Suspense fallback={<div>로딩중...</div>}>
            <DashboardContent
              initCgmData={initCgmData}
              initInsulinData={initInsulinData}
            />
          </Suspense>
        </section>
      </div>

      <section className="flex flex-col gap-4">
        <h3 className="font-bold">GlucoBeat와 건강 관리하기</h3>
        <Suspense fallback={<div>데이터를 불러오는 중입니다...</div>}>
          <DiaSection />
        </Suspense>
        <Suspense fallback={<div>데이터를 불러오는 중입니다...</div>}>
          <ReportSection />
        </Suspense>
      </section>
    </main>
  );
}
