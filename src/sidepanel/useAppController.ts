import { useCallback, useEffect, useRef, useState } from "react";
import { getBaselineFromScreen, withGuardrails } from "./app-state";
import { PROSE } from "./copy";
import { sendMessage } from "./send-message";
import { isAnalysisProgressNotice } from "../shared/analysis-progress";
import { buildRouteInfo } from "../shared/route-key";
import type { ScreenState } from "./app-state";
import type { IgnoreReason } from "../shared/messages";
import type { BaselineRecord, Guardrail, RouteInfo } from "../shared/types";

/**
 * 9.7절: Side Panel은 탭별 상태를 유지한다 — screensByRoute를 routeKey로 캐싱해
 * 다른 탭으로 갔다 돌아와도(또는 Fix 적용 후 돌아와도) 화면이 리셋되지 않는다.
 */
export function useAppController() {
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [screensByRoute, setScreensByRoute] = useState<Record<string, ScreenState>>({});
  const [rootError, setRootError] = useState<string | null>(null);

  const screensRef = useRef(screensByRoute);
  screensRef.current = screensByRoute;
  const routeInfoRef = useRef(routeInfo);
  routeInfoRef.current = routeInfo;

  const setScreen = useCallback((routeKey: string, screen: ScreenState) => {
    setScreensByRoute((prev) => ({ ...prev, [routeKey]: screen }));
  }, []);

  const loadBaselineForRoute = useCallback(
    async (routeKey: string) => {
      const res = await sendMessage("GET_BASELINE", { routeKey });
      if (!res.ok) {
        setScreen(routeKey, {
          kind: "error",
          code: res.error.code,
          message: res.error.message,
          retry: () => loadBaselineForRoute(routeKey),
        });
        return;
      }
      setScreen(routeKey, res.data ? { kind: "baseline_ready", baseline: res.data } : { kind: "no_baseline" });
    },
    [setScreen],
  );

  const refreshActiveRoute = useCallback(async () => {
    try {
      const res = await sendMessage("GET_ACTIVE_ROUTE", undefined);
      if (!res.ok) {
        // A transient failure once we already have a route just keeps the
        // last known-good screen on screen; a failure before we've ever had
        // one is the only case the UI needs to actively surface.
        if (!routeInfoRef.current) setRootError(res.error.message);
        return;
      }
      setRootError(null);
      const info = buildRouteInfo(res.data.fullUrl);
      setRouteInfo(info);
      if (!(info.routeKey in screensRef.current)) {
        setScreen(info.routeKey, { kind: "loading" });
        await loadBaselineForRoute(info.routeKey);
      }
    } catch (err) {
      if (!routeInfoRef.current) {
        setRootError(err instanceof Error ? err.message : String(err));
      }
    }
  }, [loadBaselineForRoute, setScreen]);

  const refreshSettings = useCallback(async () => {
    const res = await sendMessage("GET_SETTINGS", undefined);
    if (res.ok) setHasApiKey(res.data.hasApiKey);
  }, []);

  useEffect(() => {
    refreshActiveRoute();
    refreshSettings();
    const onTabActivated = () => {
      refreshActiveRoute();
    };
    const onTabUpdated = (_tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (changeInfo.status === "complete" || changeInfo.url) refreshActiveRoute();
    };
    // Pipeline progress arrives as broadcasts while a check is in flight.
    // Steps are only ever appended from what the worker actually reported —
    // the screen never predicts a step that hasn't happened.
    const onProgress = (message: unknown) => {
      if (!isAnalysisProgressNotice(message)) return;
      setScreensByRoute((prev) => {
        const current = prev[message.routeKey];
        if (!current || current.kind !== "analyzing") return prev;
        const others = current.steps.filter((s) => s.step !== message.step);
        return {
          ...prev,
          [message.routeKey]: {
            ...current,
            steps: [...others, { step: message.step, status: message.status }],
          },
        };
      });
    };

    chrome.tabs.onActivated.addListener(onTabActivated);
    chrome.tabs.onUpdated.addListener(onTabUpdated);
    chrome.runtime.onMessage.addListener(onProgress);
    return () => {
      chrome.tabs.onActivated.removeListener(onTabActivated);
      chrome.tabs.onUpdated.removeListener(onTabUpdated);
      chrome.runtime.onMessage.removeListener(onProgress);
    };
  }, [refreshActiveRoute, refreshSettings]);

  const setAsBaseline = useCallback(async () => {
    const route = routeInfoRef.current;
    if (!route) return;
    setScreen(route.routeKey, { kind: "loading" });
    const res = await sendMessage("SAVE_BASELINE", undefined);
    if (!res.ok) {
      if (res.error.code === "PAGE_NOT_READY") {
        // Same designed screen as a blocked check, minus the visible-only
        // escape hatch: you can analyse a partial page, but you must not
        // store one as the baseline.
        setScreen(route.routeKey, {
          kind: "unavailable",
          message: res.error.message,
          canAnalyzeVisibleOnly: false,
        });
      } else {
        setScreen(route.routeKey, {
          kind: "error",
          code: res.error.code,
          message: res.error.message,
          retry: setAsBaseline,
        });
      }
      return;
    }
    setScreen(route.routeKey, { kind: "baseline_saved", baseline: res.data });
  }, [setScreen]);

  const checkChanges = useCallback(async () => {
    const route = routeInfoRef.current;
    if (!route) return;
    const priorBaseline = getBaselineFromScreen(screensRef.current[route.routeKey]);
    setScreen(route.routeKey, { kind: "analyzing", label: PROSE.analyzingCompare, steps: [] });

    const res = await sendMessage("CHECK_CHANGES", { routeKey: route.routeKey });
    if (!res.ok) {
      if (res.error.code === "PAGE_NOT_READY") {
        setScreen(route.routeKey, { kind: "unavailable", message: res.error.message, canAnalyzeVisibleOnly: true });
      } else {
        setScreen(route.routeKey, {
          kind: "error",
          code: res.error.code,
          message: res.error.message,
          retry: checkChanges,
        });
      }
      return;
    }

    const baseline = priorBaseline ?? (await fetchBaseline(route.routeKey));
    if (!baseline) return;
    setScreen(route.routeKey, {
      kind: "results",
      baseline,
      result: { ...res.data, limited: false },
      ignoredIssueIds: [],
    });
  }, [setScreen]);

  const analyzeVisibleOnly = useCallback(async () => {
    const route = routeInfoRef.current;
    if (!route) return;
    const priorBaseline = getBaselineFromScreen(screensRef.current[route.routeKey]);
    setScreen(route.routeKey, { kind: "analyzing", label: PROSE.analyzingVisibleOnly, steps: [] });

    const res = await sendMessage("ANALYZE_VISIBLE_ONLY", { routeKey: route.routeKey });
    if (!res.ok) {
      setScreen(route.routeKey, {
        kind: "error",
        code: res.error.code,
        message: res.error.message,
        retry: analyzeVisibleOnly,
      });
      return;
    }

    const baseline = priorBaseline ?? (await fetchBaseline(route.routeKey));
    if (!baseline) return;
    setScreen(route.routeKey, {
      kind: "results",
      baseline,
      result: { ...res.data, limited: true },
      ignoredIssueIds: [],
    });
  }, [setScreen]);

  const analyzeAgain = useCallback(async () => {
    const route = routeInfoRef.current;
    if (!route) return;
    const current = screensRef.current[route.routeKey];
    if (!current || current.kind !== "results") return;
    const { baseline, result: prevResult } = current;

    setScreen(route.routeKey, { kind: "analyzing", label: PROSE.analyzingAgain, steps: [] });
    const res = await sendMessage("ANALYZE_AGAIN", { routeKey: route.routeKey });
    if (!res.ok) {
      setScreen(route.routeKey, {
        kind: "error",
        code: res.error.code,
        message: res.error.message,
        retry: analyzeAgain,
      });
      return;
    }

    setScreen(route.routeKey, {
      kind: "results",
      baseline,
      result: {
        ...prevResult,
        analysis: res.data.analysis,
        comparisonContext: { ...prevResult.comparisonContext, analysisMode: res.data.analysis.analysisMode },
      },
      ignoredIssueIds: [],
    });
  }, [setScreen]);

  const acceptCurrentState = useCallback(async () => {
    const route = routeInfoRef.current;
    if (!route) return;
    const res = await sendMessage("ACCEPT_CURRENT_STATE", { routeKey: route.routeKey });
    if (!res.ok) {
      setScreen(route.routeKey, {
        kind: "error",
        code: res.error.code,
        message: res.error.message,
        retry: acceptCurrentState,
      });
      return;
    }
    setScreen(route.routeKey, { kind: "baseline_ready", baseline: res.data });
  }, [setScreen]);

  const ignoreIssue = useCallback(
    async (issueId: string, reason: IgnoreReason) => {
      const route = routeInfoRef.current;
      if (!route) return;
      await sendMessage("IGNORE_ISSUE", { routeKey: route.routeKey, issueId, reason });
      setScreensByRoute((prev) => {
        const current = prev[route.routeKey];
        if (!current || current.kind !== "results") return prev;
        return {
          ...prev,
          [route.routeKey]: { ...current, ignoredIssueIds: [...current.ignoredIssueIds, issueId] },
        };
      });
    },
    [],
  );

  const saveGuardrails = useCallback(async (guardrails: Guardrail[]): Promise<boolean> => {
    const route = routeInfoRef.current;
    if (!route) return false;
    const res = await sendMessage("SAVE_GUARDRAILS", { routeKey: route.routeKey, guardrails });
    if (!res.ok) return false;
    setScreensByRoute((prev) => {
      const current = prev[route.routeKey];
      if (!current) return prev;
      const updated = withGuardrails(current, res.data);
      return updated ? { ...prev, [route.routeKey]: updated } : prev;
    });
    return true;
  }, []);

  const finishBaselineSetup = useCallback(async (guardrails: Guardrail[]) => {
    const route = routeInfoRef.current;
    if (!route) return;
    const current = screensRef.current[route.routeKey];
    if (!current || current.kind !== "baseline_saved") return;
    await saveGuardrails(guardrails);
    setScreensByRoute((prev) => {
      const latest = prev[route.routeKey];
      const baseline = getBaselineFromScreen(latest) ?? current.baseline;
      return { ...prev, [route.routeKey]: { kind: "baseline_ready", baseline } };
    });
  }, [saveGuardrails]);

  const recommendGuardrails = useCallback(async (routeKey: string): Promise<Guardrail[]> => {
    const res = await sendMessage("RECOMMEND_GUARDRAILS", { routeKey });
    return res.ok ? res.data : [];
  }, []);

  const currentScreen: ScreenState = routeInfo ? screensByRoute[routeInfo.routeKey] ?? { kind: "loading" } : { kind: "loading" };

  return {
    routeInfo,
    hasApiKey,
    rootError,
    screen: currentScreen,
    actions: {
      setAsBaseline,
      checkChanges,
      analyzeVisibleOnly,
      analyzeAgain,
      acceptCurrentState,
      ignoreIssue,
      saveGuardrails,
      finishBaselineSetup,
      recommendGuardrails,
      refreshSettings,
      refreshActiveRoute,
    },
  };
}

async function fetchBaseline(routeKey: string): Promise<BaselineRecord | null> {
  const res = await sendMessage("GET_BASELINE", { routeKey });
  return res.ok ? res.data : null;
}
