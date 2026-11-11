'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function CallAgentButton({
  mode = 'directory',
  providerId = null,
  label = 'Talk to AwazBot',
  sublabel = null,
  className = '',
  variant = 'default',
  size = 'default',
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleCall = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/calls/web', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode,
          provider_id: providerId || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to initiate call session.');
        return;
      }

      // Store call session in sessionStorage for the call screen
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`call_${data.roomName}`, JSON.stringify(data));
      }

      toast.success('Call room created! Connecting...');
      router.push(`/call/${data.roomName}`);
    } catch (err) {
      console.error('Call initialization error:', err);
      toast.error('Network error connecting to voice server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleCall}
      disabled={loading}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 rounded-full border-2 border-current border-r-transparent animate-spin" />
          Connecting...
        </span>
      ) : (
        <div className="flex flex-col items-center">
          <span>{label}</span>
          {sublabel && (
            <span className="text-xs font-normal opacity-90">{sublabel}</span>
          )}
        </div>
      )}
    </Button>
  );
}
