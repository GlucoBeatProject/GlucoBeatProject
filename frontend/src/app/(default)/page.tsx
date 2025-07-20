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
import { CGM_MAX, CGM_MIN } from '@/const/cgm';

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
  )
    .json()
    .then(
      async (data) =>
        await (
          await fetch(`http://127.0.0.1:4000/diagnosis/${data[0].dia_id}`)
        ).json()
    );

  const recentReport = await (
    await fetch(`http://127.0.0.1:4000/reports?user_id=1`)
  )
    .json()
    .then(async (data) =>
      data.length > 0
        ? await (
            await fetch(`http://127.0.0.1:4000/reports/${data[0].report_id}`)
          ).json()
        : null
    );

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
              {initCgmData[initCgmData.length - 1].cgm_day
                .at(-1)
                .cgm.toFixed(0) > CGM_MAX ||
              initCgmData[initCgmData.length - 1].cgm_day
                .at(-1)
                .cgm.toFixed(0) < CGM_MIN ? (
                <div className="py-3 px-4 rounded-md bg-primary/15 text-primary font-bold">
                  ⚠️ 현재{' '}
                  {initCgmData[initCgmData.length - 1].cgm_day
                    .at(-1)
                    .cgm.toFixed(0) > CGM_MAX
                    ? '고'
                    : '저'}
                  혈당 상태입니다.
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="mx-auto">
              {initCgmData.length > 0 ? (
                <div className="flex flex-col gap-2 items-center w-fit h-full justify-center">
                  <p
                    className={`text-4xl sm:text-5xl font-bold ${
                      initCgmData[initCgmData.length - 1].cgm_day
                        .at(-1)
                        .cgm.toFixed(0) > CGM_MAX ||
                      initCgmData[initCgmData.length - 1].cgm_day
                        .at(-1)
                        .cgm.toFixed(0) < CGM_MIN
                        ? 'text-primary'
                        : 'text-green-600'
                    }`}
                  >
                    {initCgmData[initCgmData.length - 1].cgm_day
                      .at(-1)
                      .cgm.toFixed(2)}{' '}
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
          <DashboardContent
            initCgmData={initCgmData}
            initInsulinData={initInsulinData}
          />
        </section>
      </div>

      <section className="flex flex-col gap-4">
        <h3 className="font-bold">GlucoBeat와 건강 관리하기</h3>
        <Card>
          <CardHeader>
            <CardTitle>최근 의사의 진단</CardTitle>
            <CardDescription>
              {format(parseISO(recentDia?.created_at), 'yyyy년 M월 d일 HH:mm')}
            </CardDescription>
          </CardHeader>

          <CardContent className="leading-relaxed text-gray-800 whitespace-pre-line">
            {recentDia?.dia_message || '최근 진단 내역이 존재하지 않습니다.'}
          </CardContent>

          <CardFooter>
            <Link
              href={`/diagnosis/${recentDia?.dia_id}`}
              className="text-sm text-primary hover:underline flex justify-end w-full"
            >
              본문 보러가기
            </Link>
          </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>최근 심층 분석 리포트</CardTitle>
            <CardDescription>
              {format(
                parseISO(recentReport?.created_at),
                'yyyy년 M월 d일 HH:mm'
              )}
            </CardDescription>
          </CardHeader>

          <CardContent className="text-gray-800 text-[20px] font-bold">
            {recentReport?.report_title ||
              '최근 생성된 리포트가 존재하지 않습니다.'}
          </CardContent>

          <CardFooter>
            <Link
              href={`/report/${recentReport?.report_id}`}
              className="text-sm text-primary hover:underline flex justify-end w-full"
            >
              리포트 보러가기
            </Link>
          </CardFooter>
        </Card>
      </section>
    </main>
  );
}
