import { NextResponse } from 'next/server';
import { getCurrentStoreType } from '@/lib/store';
import { isAIConfigured, getAIModelDisplayName } from '@/lib/ai/gemini';

export async function GET() {
  return NextResponse.json({
    storeType: getCurrentStoreType(),
    aiConfigured: isAIConfigured(),
    aiModel: getAIModelDisplayName(),
  });
}
