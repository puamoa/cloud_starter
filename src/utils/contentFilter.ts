import { curriculum, WeekCurriculum } from '@/data/curriculum';
import { publishConfig } from '@/data/siteConfig';

/**
 * 공개 대상 커리큘럼을 반환합니다.
 *
 * - dev 모드 (npm run dev): 모든 step 표시
 * - production 빌드 (npm run build): publishedSteps에 포함된 step만 표시
 */
export function getVisibleCurriculum(): WeekCurriculum[] {
  if (import.meta.env.DEV) {
    return curriculum;
  }
  return curriculum.filter((week) =>
    publishConfig.publishedSteps.includes(week.week),
  );
}

/**
 * 특정 step이 공개 대상인지 확인합니다.
 */
export function isStepPublished(stepNumber: number): boolean {
  if (import.meta.env.DEV) {
    return true;
  }
  return publishConfig.publishedSteps.includes(stepNumber);
}
