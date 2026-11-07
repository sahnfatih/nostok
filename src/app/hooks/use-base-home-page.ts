'use client';

import { AppBridgeHelper } from '@ikas/app-helpers';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { TokenHelpers } from '@/helpers/token-helpers';
import { ApiRequests } from '@/lib/api-requests';

/**
 * Custom hook for managing the base home page authentication and routing logic.
 *
 * Flow:
 * - Outside the iframe (direct browser access): never touch the App Bridge
 *   (its calls only reject after a timeout), go straight to authorization.
 * - Inside the iframe: close the loader, get the bridge token, and only treat
 *   the app as installed when the BACKEND has an ikas token for it — a bridge
 *   token alone is not proof of install (it is issued before any OAuth code
 *   was exchanged).
 */
export function useBaseHomePage() {
  const startedRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    const redirectToAuthorize = () => {
      const storeName = new URLSearchParams(window.location.search).get('storeName');
      if (storeName && window.top) {
        // Top-level start: the Admin keeps its own session around OAuth.
        window.top.location.href = `/api/oauth/authorize/ikas?storeName=${encodeURIComponent(storeName)}`;
        return;
      }
      router.push('/authorize-store');
    };

    const initializeAuthFlow = async () => {
      try {
        // Close any existing loader in the ikas AppBridge to prevent UI conflicts
        AppBridgeHelper.closeLoader();

        // Bridge calls only work inside the iframe; outside they reject on a timer.
        if (window.self === window.top) {
          const urlParams = new URLSearchParams(window.location.search);
          const storeName = urlParams.get('storeName');
          if (storeName) {
            window.location.replace(`/api/oauth/authorize/ikas?storeName=${encodeURIComponent(storeName)}`);
            return;
          }
          router.push('/authorize-store');
          return;
        }

        const existingToken = await TokenHelpers.getTokenForIframeApp();
        if (!existingToken) {
          redirectToAuthorize();
          return;
        }

        // A bridge token exists — confirm the backend actually completed OAuth
        // for this installation before entering the dashboard.
        try {
          const res = await ApiRequests.ikas.getMerchant(existingToken);
          if (res.status === 200) {
            router.push('/dashboard');
            return;
          }
        } catch (error) {
          const status = (error as { response?: { status?: number } })?.response?.status;
          if (status !== 404) {
            // Transient failure — the dashboard surfaces its own error states.
            router.push('/dashboard');
            return;
          }
        }

        // Backend has no ikas token for this authorizedAppId — restart OAuth.
        redirectToAuthorize();
      } catch (error) {
        console.error('Error during base home page initialization:', error);
        router.push('/authorize-store');
      }
    };

    // Prevent multiple simultaneous initialization attempts
    if (startedRef.current) {
      return;
    }

    startedRef.current = true;
    initializeAuthFlow();

    return () => {};

    // Dependencies intentionally minimal - only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
