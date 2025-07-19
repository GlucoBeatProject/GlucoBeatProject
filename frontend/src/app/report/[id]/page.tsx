import DynamicReportRenderer from '@/components/report/DynamicReportRenderer';
import ReportHeader from '@/components/ReportHeader';

async function ReportDetailPage({ params }: { params: { id: string } }) {
  const { id } = await params;
  const data = await (
    await fetch(`http://127.0.0.1:4000/reports/${id}`)
  ).json();

  const raw = data.report_contents;
  const dataArray = JSON.parse(raw);

  for (const item of dataArray) {
    if (typeof item.content === 'string' && item.content.includes('```jsx')) {
      const content = item.content;

      const jsxBlockRegex = /```jsx\n([\s\S]*?)\n?```/;
      const match = content.match(jsxBlockRegex);

      if (match && match[1]) {
        return (
          <div className="pt-[60px]">
            <ReportHeader title={data.report_title} />
            <main className="md:max-w-[720px] md:mx-auto">
              {match && match[1] && (
                <DynamicReportRenderer codeString={match[1]} />
              )}
            </main>
          </div>
        );
      }
    }
  }

  return (
    <>
      <div>리포트 생성에 실패했습니다.</div>
    </>
  );
}

export default ReportDetailPage;
