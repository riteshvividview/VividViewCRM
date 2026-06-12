"use client";

import { useEffect, useState } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OfflineScreen() {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) window.location.reload();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [wasOffline]);

  if (isOnline) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-white dark:bg-gray-950 flex flex-col items-center justify-center p-6 text-center">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-orange-100 dark:bg-orange-900/20 rounded-full blur-xl scale-150" />
        <div className="relative bg-orange-50 dark:bg-orange-900/30 p-8 rounded-full">
          <WifiOff className="h-16 w-16 text-orange-400" strokeWidth={1.5} />
        </div>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
        No Internet Connection
      </h1>
      <p className="text-gray-500 dark:text-gray-400 max-w-xs leading-relaxed mb-2">
        Please turn on your internet connection to continue using VividCRM.
      </p>
      <p className="text-sm text-gray-400 dark:text-gray-500 mb-8">
        The page will reload automatically once you're back online.
      </p>

      <Button
        variant="outline"
        onClick={() => window.location.reload()}
        className="gap-2"
      >
        <RefreshCw className="h-4 w-4" />
        Try Again
      </Button>
    </div>
  );
}
