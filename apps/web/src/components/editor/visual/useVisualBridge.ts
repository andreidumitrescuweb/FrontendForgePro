'use client';

import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { isRuntimeMessage, type HostMessage, type NodeInfo } from './protocol';

/** Omit that distributes over a union so each variant keeps its own fields. */
type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;
export type SendableMessage = DistributiveOmit<HostMessage, 'source'>;

interface Handlers {
  onReady?: () => void;
  onSelected?: (node: NodeInfo) => void;
  onDeselected?: () => void;
  onChanged?: () => void;
}

/**
 * Bridges the React host with the runtime inside the preview iframe.
 * Exposes a typed `send` for fire-and-forget commands and a promise-based
 * `serialize` that resolves with the updated file map.
 */
export function useVisualBridge(iframeRef: RefObject<HTMLIFrameElement | null>, handlers: Handlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const nonceRef = useRef(0);
  const pending = useRef(new Map<number, (files: Record<string, string>) => void>());

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!isRuntimeMessage(e.data)) return;
      const msg = e.data;
      const h = handlersRef.current;
      switch (msg.type) {
        case 'ready':
          h.onReady?.();
          break;
        case 'selected':
          h.onSelected?.(msg.node);
          break;
        case 'deselected':
          h.onDeselected?.();
          break;
        case 'changed':
          h.onChanged?.();
          break;
        case 'serialized': {
          const resolve = pending.current.get(msg.nonce);
          if (resolve) {
            pending.current.delete(msg.nonce);
            resolve(msg.files);
          }
          break;
        }
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const send = useCallback(
    (msg: SendableMessage) => {
      iframeRef.current?.contentWindow?.postMessage({ ...msg, source: 'ff' }, '*');
    },
    [iframeRef],
  );

  const serialize = useCallback((): Promise<Record<string, string>> => {
    const nonce = ++nonceRef.current;
    return new Promise((resolve, reject) => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return reject(new Error('Preview not ready'));
      pending.current.set(nonce, resolve);
      win.postMessage({ source: 'ff', type: 'serialize', nonce }, '*');
      // Safety net: never leave a save hanging if the runtime is gone.
      setTimeout(() => {
        if (pending.current.has(nonce)) {
          pending.current.delete(nonce);
          reject(new Error('Serialize timed out'));
        }
      }, 5000);
    });
  }, [iframeRef]);

  return { send, serialize };
}
