import MakeReportBtn from '@/components/report/MakeReportBtn';
import ReportHeader from '@/components/ReportHeader';
import ReportCard from '@/components/report/ReportCard';
import SimpleHeader from '@/components/SimpleHeader';

async function ReportPage() {
  const reports = await (
    await fetch(`http://127.0.0.1:4000/reports?user_id=1`)
  ).json();

  return (
    <div className="pt-[60px]">
      <SimpleHeader />

      <div className="mt-5 px-4 flex flex-col gap-4 md:max-w-[720px] md:mx-auto md:px-0 pb-[96px]">
        <h1 className="pt-5 text-2xl font-bold pb-5">
          심층 분석 리포트
          <p className="text-sm text-gray-400 mt-2">
            매번 데이터의 특성에 맞춰 가장 효과적인 전달 방식으로 리포트를
            작성해 드려요.
          </p>
        </h1>

        {reports.map((item: any) => (
          <ReportCard
            key={item.report_id}
            id={item.report_id}
            created_at={item.created_at}
            title={item.report_title}
          />
        ))}
        <MakeReportBtn />
      </div>
    </div>
  );
}

export default ReportPage;
