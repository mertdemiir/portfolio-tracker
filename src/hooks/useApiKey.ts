import { useLocalStorage } from './useLocalStorage';

export function useApiKey() {
  const envKey = import.meta.env.VITE_FINNHUB_API_KEY as string | undefined;
  const [storedKey, setStoredKey] = useLocalStorage<string>('finnhub-api-key', '');

  const apiKey = envKey || storedKey;

  return {
    apiKey,
    setApiKey: setStoredKey,
    hasApiKey: apiKey.length > 0,
  };
}
