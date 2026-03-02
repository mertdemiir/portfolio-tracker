import { Loader2 } from 'lucide-react';

export function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-t-muted">
      <Loader2 className="w-8 h-8 animate-spin text-accent mb-3" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
