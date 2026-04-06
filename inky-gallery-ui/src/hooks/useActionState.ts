import { useState } from 'react';
import { extractErrorMessage } from '@/lib/error';

export function useActionState() {
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const runAction = async (message: string, action: () => Promise<void>) => {
    setBusyMessage(message);
    setErrorMessage(null);
    try {
      await action();
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setBusyMessage(null);
    }
  };

  return {
    busyMessage,
    errorMessage,
    setErrorMessage,
    runAction,
  };
}
