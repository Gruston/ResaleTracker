// Demo mode seed: the prototype's sample business (src/domain/fixtures.ts).
import { sampleData } from '@/domain/fixtures';
import type { BusinessData } from '@/domain/types';
import { DEMO_BUSINESS_ID } from '@/lib/demo-id';

export function buildDemoSeed(): BusinessData {
  const copy = JSON.parse(JSON.stringify(sampleData)) as BusinessData;
  copy.settings.businessId = DEMO_BUSINESS_ID;
  return copy;
}
