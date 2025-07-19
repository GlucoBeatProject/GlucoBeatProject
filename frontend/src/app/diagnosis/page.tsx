import { format, parseISO } from 'date-fns';
import ReportHeader from '@/components/ReportHeader';
import Link from 'next/link';
import { ko } from 'date-fns/locale';
import SimpleHeader from '@/components/SimpleHeader';

export default async function DiagnosisListPage() {
  const diagnosisList = await (
    await fetch(`http://127.0.0.1:4000/diagnosis?user_id=1`, {
      cache: 'no-store',
    })
  ).json();

  return (
    <>
      <SimpleHeader />
      <main className="mt-[60px] md:max-w-[720px] md:mx-auto px-4 md:px-0">
        <h1 className="pt-10 text-2xl font-bold pb-2">나의 진단 내역</h1>
        <p className="text-sm text-gray-400">
          이해하기 어려운 진단 내역, GlucoBeat가 이해하기 쉽게 진단 내용을 분석
          및 해석해 드려요.
        </p>
        <div className="mt-9">
          {diagnosisList.length === 0 ? (
            <p className="text-gray-500 text-sm">진단 내역이 없습니다.</p>
          ) : (
            <div className="flex flex-col gap-5">
              {diagnosisList.map((dia: any) => (
                <Link
                  key={dia.dia_id}
                  href={`/diagnosis/${dia.dia_id}`}
                  className="h-[107px] px-5 py-6 bg-white flex flex-col justify-between rounded-2xl border border-gray-200 shadow-sm hover:bg-gray-400/10"
                >
                  <h6 className="font-bold text-[18px] md:text-xl truncate">
                    {format(
                      new Date(dia.created_at),
                      'yyyy년 M월 dd일(eee) HH:mm',
                      {
                        locale: ko,
                      }
                    )}
                  </h6>
                  <p className="text-sm text-gray-700 whitespace-pre-line">
                    {dia.diagnosis_preview}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
