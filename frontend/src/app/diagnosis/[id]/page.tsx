import { notFound } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { ko } from 'date-fns/locale'; // 한국어 포맷을 위해
import ReportHeader from '@/components/ReportHeader';

interface DiagnosisDetail {
  dia_id: number;
  dia_message: string;
  dia_llm_message: string;
  created_at: string;
}

export default async function DiagnosisDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = await params;
  const res = await fetch(`http://127.0.0.1:4000/diagnosis/${id}`, {
    cache: 'no-store',
  });

  if (!res.ok) notFound();

  const data: DiagnosisDetail = await res.json();

  return (
    <>
      <ReportHeader
        title={`${format(parseISO(data.created_at), 'yyyy년 M월 d일', {
          locale: ko,
        })}의 진단`}
      />
      <main className="mt-[80px] px-4 md:max-w-[720px] md:mx-auto pb-5">
        {/* <h1 className="text-2xl font-bold">진단서 #{data.dia_id}</h1> */}
        <h1 className="text-gray-400 text-sm text-end">
          {format(parseISO(data.created_at), 'yyyy. MM. dd HH:mm', {
            locale: ko,
          })}
        </h1>
        {/* 원본 메시지 */}
        <section className="border rounded-lg p-4 mt-6">
          <h2 className="font-semibold mb-4 text-2xl">💉 의사 진단</h2>
          <p className="whitespace-pre-line text-sm md:text-base">
            {data.dia_message}
          </p>
        </section>

        {/* LLM 확장 메시지 */}
        {data.dia_llm_message && (
          <section className="border rounded-lg p-4 mt-6">
            <h2 className="font-semibold mb-4 text-2xl">💡 AI 상세 분석</h2>
            <p className="whitespace-pre-line text-sm md:text-base">
              {JSON.parse(data.dia_llm_message)}
            </p>
          </section>
        )}
      </main>
    </>
  );
}
