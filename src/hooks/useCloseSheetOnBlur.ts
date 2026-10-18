import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';

/**
 * Closes an open sheet/menu when the screen hosting it loses focus.
 *
 * WHY THIS EXISTS (BUG 1 — the ghost context menu): every action sheet in
 * Arkify is driven by screen-local state, and React Navigation keeps tab and
 * stack screens MOUNTED after you leave them. A sheet left open therefore
 * outlived its screen: switching tabs (or pushing a stack screen) left the
 * menu floating — fully interactive on web, rendered as a root-level RN Modal
 * on native — over whatever screen came next, swallowing the first tap and
 * acting on the previous screen's track. Reproduced in the rendered QA shell:
 * open a row menu on Home, switch to Search, and the Home menu is still on
 * top of Search.
 *
 * The fix closes the sheet on blur — no timeouts, no event suppression, the
 * menu simply cannot outlive the screen it belongs to. The latest-ref pattern
 * keeps the parent's `close` callback fresh without re-subscribing.
 */
export function useCloseSheetOnBlur(open: boolean, close: () => void): void {
  const openRef = useRef(open);
  openRef.current = open;
  const closeRef = useRef(close);
  closeRef.current = close;

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (openRef.current) closeRef.current();
      };
    }, [])
  );
}
