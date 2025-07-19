import { format, parseISO } from 'date-fns';
import ReportHeader from '@/components/ReportHeader';
export default async function DiagnosisListPage() {
  const diagnosisList = await (
    await fetch(`http://127.0.0.1:4000/diagnosis?user_id=1`, {
      cache: 'no-store',
    })
  ).json();

  return (
    <>

      <ReportHeader title="나의 진단 내역" />
      <main className="mt-[60px] md:max-w-[720px] md:mx-auto">
        <div className="p-6 space-y-6">
          {diagnosisList.length === 0 ? (
            <p className="text-gray-500 text-sm">진단 내역이 없습니다.</p>
          ) : (
            <ul className="space-y-4">
              {diagnosisList.map((dia: any) => (
                <li
                  key={dia.dia_id}
                  className="h-[107px] p-4 md:p-5 bg-white rounded-2xl border border-gray-200 shadow-sm "
                >
                  <div className="flex justify-between items-center mb-2">
                    <p className="font-semibold">
                      {format(parseISO(dia.created_at), 'yyyy년 M월 d일 HH:mm')}
                    </p>
                    <a
                      href={`/diagnosis/${dia.dia_id}`}
                      className="text-sm text-primary px-3 py-1 rounded-md transition-colors hover:bg-primary/10"
                    >
                      →
                    </a>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-line">
                    {dia.diagnosis_preview}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
