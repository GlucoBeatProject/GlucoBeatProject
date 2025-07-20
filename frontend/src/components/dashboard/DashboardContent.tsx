'use client';

import { Chart } from './Chart';
import { ChevronDownIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { DateRange } from 'react-day-picker';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';

interface Props {
  initCgmData: any[];
  initInsulinData: any[];
}

function DashboardContent({ initCgmData, initInsulinData }: Props) {
  const [cgm, setCgm] = useState<
    {
      date: string;
      cgm_mean: number;
      cgm_day: { time: string; cgm: number }[] | undefined;
    }[]
  >(initCgmData);
  const [insulin, setInsulin] = useState<
    {
      date: string;
      insulin_mean: number;
      insulin_day:
        | { time: string; insulin: number; algorithm: string }[]
        | undefined;
    }[]
  >(initInsulinData);

  const [open, setOpen] = useState(false);
  const today = new Date();
  const [dateRange, setDateRange] = useState<DateRange>({
    from: today,
    to: today,
  });

  let curDate = `${
    dateRange?.from ? dateRange.from.toLocaleDateString('ko-kr') : ''
  } - ${dateRange?.to ? dateRange.to.toLocaleDateString('ko-kr') : ''}`;

  const getData = async (type: 'cgm' | 'insulin') => {
    const res = await (
      await fetch(
        `http://127.0.0.1:4000/dashboard/${type}?start_date=${format(
          dateRange?.from ?? today,
          'yyyy-MM-dd'
        )}&end_date=${format(dateRange?.to ?? today, 'yyyy-MM-dd')}`
      )
    ).json();
    if (type === 'cgm') setCgm(res);
    else setInsulin(res);
  };

  useEffect(() => {
    getData('cgm');
    getData('insulin');
  }, [dateRange]);

  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor="date" className="px-1 text-gray-400">
          조회 기간을 선택하세요.
        </Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              id="date"
              className="w-56 justify-between font-normal"
            >
              {curDate ?? 'Select date'}
              <ChevronDownIcon />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto overflow-hidden p-0" align="start">
            <Calendar
              required
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={setDateRange}
              captionLayout="dropdown"
            />
          </PopoverContent>
        </Popover>
      </div>
      <Chart
        type="cgm"
        isRange={cgm.length > 0 ? cgm[0].cgm_day == undefined : true}
        data={cgm}
      />
      <Chart
        type="insulin"
        isRange={
          insulin.length > 0 ? insulin[0].insulin_day == undefined : true
        }
        data={insulin}
      />
    </>
  );
}

export default DashboardContent;
