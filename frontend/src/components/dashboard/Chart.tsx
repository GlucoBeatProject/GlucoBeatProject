'use client';

import { Area, AreaChart, XAxis, YAxis } from 'recharts';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { CGM_MAX, CGM_MIN } from '@/const/cgm';

const chartConfig = {
  cgm: {
    label: 'cgm',
    color: '#2563eb',
  },
  insulin: {
    label: 'insulin',
    color: '#60a5fa',
  },
} satisfies ChartConfig;

interface Props {
  type: 'cgm' | 'insulin';
  isRange?: boolean;
  data: any[];
}

export function Chart({ type, isRange, data }: Props) {
  const CHART_INFO = {
    cgm: {
      title: 'CGM',
      description: '시간 당 혈당 수치 또는 일일 평균 혈당 수치를 보여줍니다.',
      color: '#8884d8',
      theme: 'url(#colorUv)',
      dataKey: isRange ? 'cgm_mean' : 'cgm',
    },
    insulin: {
      title: 'Insulin',
      description:
        '시간 당 인슐린 주입량 또는 일일 평균 인슐린 주입량을 보여줍니다.',
      color: '#82ca9d',
      theme: 'url(#colorPv)',
      dataKey: isRange ? 'insulin_mean' : 'insulin',
    },
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;

      const formattedLabel = payload[0].payload.date
        ? new Date(label).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })
        : label;

      return (
        <div className="p-2 text-xs bg-white border rounded-md shadow-lg">
          <p className="font-bold mb-2">{formattedLabel}</p>
          {payload.map((p: any, index: any) => (
            <div
              key={index}
              className="flex justify-between gap-4 items-center"
            >
              <p className="text-gray-400">{p.name}</p>
              {p.name === 'cgm' ? (
                <p
                  className={`flex items-center ${
                    p.value.toFixed(0) > CGM_MAX || p.value.toFixed(0) < CGM_MIN
                      ? 'text-primary'
                      : ''
                  }`}
                >
                  {p.value.toFixed(4)}
                  {p.value.toFixed(0) > CGM_MAX ||
                  p.value.toFixed(0) < CGM_MIN ? (
                    <span className="text-[10px] text-primary ml-1 border rounded-full border-primary px-[2.5px]">
                      {p.value.toFixed(0) > CGM_MAX ? '고' : '저'}
                    </span>
                  ) : null}
                </p>
              ) : (
                <p className={`flex items-center`}>{p.value.toFixed(4)}</p>
              )}
            </div>
          ))}
          {data.algorithm && (
            <div className="flex justify-between gap-4 mt-1">
              <p className="text-gray-400">사용 알고리즘</p>
              <p>{data.algorithm}</p>
            </div>
          )}
        </div>
      );
    }

    return null;
  };
  return (
    <Card className="pt-0 gap-4">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5">
        <div className="grid flex-1 gap-1">
          <CardTitle>{CHART_INFO[type].title}</CardTitle>
          <CardDescription>{CHART_INFO[type].description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pl-0 pr-6 pt-4">
        {data.length > 0 ? (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[250px] w-full"
          >
            <AreaChart data={isRange ? data : data[0][`${type}_day`]}>
              <defs>
                <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorPv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey={isRange ? 'date' : 'time'}
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                minTickGap={32}
                tickFormatter={(value) => {
                  if (!isRange) return value;
                  const date = new Date(value);
                  return date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  });
                }}
              />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip cursor={false} content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey={CHART_INFO[type].dataKey}
                stroke={CHART_INFO[type].color}
                fillOpacity={1}
                fill={CHART_INFO[type].theme}
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          <p className="text-center text-xs text-gray-400 h-32">
            조회하는 날짜에 데이터가 존재하지 않습니다.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
