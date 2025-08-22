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
 * 홈페이지 - 최근 심층 분석 리포트
 */
async function ReportSection() {
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
    <Card>
      <CardHeader>
        <CardTitle>최근 심층 분석 리포트</CardTitle>
        <CardDescription>
          {format(parseISO(recentReport?.created_at), 'yyyy년 M월 d일 HH:mm')}
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
  );
}

export default ReportSection;
