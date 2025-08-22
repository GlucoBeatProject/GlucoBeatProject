import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { parseISO, format } from 'date-fns';

/**
 * 홈페이지 - 최근 의사의 진단
 */
async function DiaSection() {
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

  return (
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
  );
}

export default DiaSection;
