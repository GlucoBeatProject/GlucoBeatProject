'use client';

import React, { useState, useEffect, useMemo } from 'react';
import * as Babel from '@babel/standalone';
import * as Recharts from 'recharts';
import { SyncLoader } from 'react-spinners';

interface Props {
  codeString: string;
}

export default function DynamicReportRenderer({ codeString }: Props) {
  const [Component, setComponent] = useState<React.ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const memoizedComponent = useMemo(() => {
    if (!codeString) return null;

    try {
      // ✨ 1. import와 export 구문을 모두 제거합니다.
      const sanitizedCode = codeString
        .replace(/^import.*$/gm, '') // 모든 import 줄 제거
        .replace(/^export default.*$/gm, ''); // 모든 export default 줄 제거

      // JavaScript 코드로 변환
      const transformedCode = Babel.transform(sanitizedCode, {
        presets: ['react'],
      }).code;

      if (!transformedCode) {
        throw new Error('Babel transform failed');
      }

      const dependencies = {
        React,
        ...Recharts,
      };

      // ✨ 2. 컴포넌트 이름을 동적으로 찾거나, 하드코딩된 이름으로 반환합니다.
      // AI가 생성하는 컴포넌트 이름이 일관되므로 하드코딩이 더 안정적일 수 있습니다.
      const DynamicComponent = new Function(
        ...Object.keys(dependencies),
        `
          ${transformedCode}
          
          // AI가 생성한 컴포넌트의 이름이 WeeklyGlucoseReport라고 가정합니다.
          // 이 이름이 바뀔 수 있다면 동적 찾기 로직을 사용해야 합니다.
          return WeeklyGlucoseReport; 
        `
      )(...Object.values(dependencies));

      return DynamicComponent;
    } catch (e: any) {
      console.error('AI 코드 렌더링 오류:', e);
      setError(`코드 렌더링 중 오류가 발생했습니다: ${e.message}`);
      return null;
    }
  }, [codeString]);

  useEffect(() => {
    if (memoizedComponent) {
      setComponent(() => memoizedComponent);
      setError(null);
    }
  }, [memoizedComponent]);

  if (error) {
    return (
      <div className="mx-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
        <p>
          <strong>오류 발생</strong>
        </p>
        <pre className="whitespace-pre-wrap">{error}</pre>
      </div>
    );
  }

  if (!Component) {
    return (
      <div className="w-dvw h-dvh text-white bg-black/30 fixed top-0 left-0 z-50 flex flex-col gap-6 items-center justify-center">
        <SyncLoader size={8} color="#fff" speedMultiplier={0.6} />
        <p className="text-center">리포트를 불러오는 중입니다.</p>
      </div>
    );
  }

  return <Component />;
}
