import { useCallback, useRef } from 'react';
import { useApi } from './useApi';
import { toast } from 'sonner';

export function useAutoCode(entity: string, prefix?: string) {
  const api = useApi();
  const pendingRef = useRef(false);

  const generateCode = useCallback(async (): Promise<string> => {
    const result = await api<{ code: string }>('/api/common/generate-code/', {
      method: 'POST',
      body: JSON.stringify({ entity, prefix }),
    });
    return result.code;
  }, [api, entity, prefix]);

  const validateCode = useCallback(async (
    code: string,
    excludeId?: string,
    showToast = true,
  ): Promise<boolean> => {
    if (!code || pendingRef.current) return true;

    pendingRef.current = true;
    try {
      const result = await api<{ available: boolean }>('/api/common/validate-code/', {
        method: 'POST',
        body: JSON.stringify({ entity, code, exclude_id: excludeId }),
      });
      if (!result.available && showToast) {
        toast.error(`Code "${code}" is already taken. Please try another one.`);
      }
      return result.available;
    } finally {
      pendingRef.current = false;
    }
  }, [api, entity]);

  return { generateCode, validateCode };
}
