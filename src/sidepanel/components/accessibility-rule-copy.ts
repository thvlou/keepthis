/**
 * Korean one-line restatements of the axe-core rules a real page actually
 * trips, plus the formatter for a grouped finding's detail line.
 *
 * Why a fixed map is enough. axe ships ~90 rules, but the ones that fire on
 * real pages are a small, stable set: three very different sites measured
 * live (a Korean product page, en.wikipedia.org, and W3C's deliberately
 * inaccessible demo) produced 137 findings across **nine** distinct rules,
 * all of them below. A rule with no entry falls back to axe's own first
 * condition in English, exactly as before this file existed — so an unmapped
 * rule degrades to "still readable", never to a blank or a wrong sentence.
 *
 * These sentences restate what the rule checks. They do not add a finding,
 * soften one, or claim a cause: the counts and colour values beside them come
 * from axe verbatim, and the rule id and help link stay on screen so any line
 * can be traced back. That is the same move as CLAUDE.md 4.3 — re-describing
 * a measurement is allowed; inventing one is not.
 */

import type { FindingDetail } from "../../diff/group-accessibility-findings";

/**
 * Code identifiers (`aria-label`, `role`, `<html>`, `lang`) stay in English
 * inside the Korean sentence — they are the strings the user will type in
 * their editor, per the project's language rule.
 */
export const RULE_EXPLANATIONS: Record<string, string> = {
  // Seen live on the measured pages.
  "color-contrast": "글자와 배경의 대비가 기준에 못 미칩니다",
  "aria-prohibited-attr": "role이 없는 요소에 aria-label을 썼습니다",
  "aria-allowed-role": "이 요소에 쓸 수 없는 role을 지정했습니다",
  "image-alt": "이미지에 대체 텍스트가 없습니다",
  "link-name": "링크에 읽어줄 이름이 없습니다",
  "html-has-lang": "<html>에 lang 속성이 없어 읽기 언어를 알 수 없습니다",
  "landmark-one-main": "페이지에 main 랜드마크가 없습니다",
  region: "랜드마크 안에 들어 있지 않은 콘텐츠가 있습니다",
  "select-name": "select에 연결된 label이 없습니다",

  // Common enough on real pages to be worth mapping in advance.
  "button-name": "버튼에 읽어줄 이름이 없습니다",
  label: "입력 요소에 연결된 label이 없습니다",
  "form-field-multiple-labels": "입력 요소에 label이 여러 개 연결돼 있습니다",
  "heading-order": "제목 단계가 순서대로 내려가지 않습니다",
  "duplicate-id": "같은 id가 여러 요소에 쓰였습니다",
  list: "목록 안에 li가 아닌 요소가 섞여 있습니다",
  listitem: "li가 목록 밖에 있습니다",
  "frame-title": "iframe에 title이 없습니다",
  "nested-interactive": "누를 수 있는 요소 안에 또 누를 수 있는 요소가 있습니다",
  "scrollable-region-focusable": "스크롤되는 영역에 키보드로 들어갈 수 없습니다",
  "aria-required-attr": "이 role에 반드시 필요한 aria 속성이 빠졌습니다",
  "aria-valid-attr-value": "aria 속성의 값이 올바르지 않습니다",
  "td-headers-attr": "표의 headers 속성이 같은 표의 셀을 가리키지 않습니다",
  "meta-viewport": "확대를 막는 viewport 설정입니다",
  bypass: "본문으로 건너뛰는 수단이 없습니다",
};

/**
 * The Korean sentence for a rule, or null when this build has no entry — the
 * caller then shows axe's own wording instead of guessing.
 */
export function explainRule(ruleId: string): string | null {
  return RULE_EXPLANATIONS[ruleId] ?? null;
}

/**
 * The evidence line under a group headline.
 *
 * Contrast is the only detail worth spelling out, and it reads as fragments
 * in raw form ("#858688 on #ffffff — 3.64:1 (needs 4.5:1)"), so the pieces
 * get named: which colour is the text, which is the background, what the
 * measured ratio was, and what the rule wanted.
 */
export function formatDetail(detail: FindingDetail): string {
  if (detail.kind === "text") return detail.text;
  const required = detail.required ? `, 기준 ${detail.required}` : "";
  return `글자 ${detail.foreground} / 배경 ${detail.background} — 대비 ${detail.ratio}${required}`;
}

/**
 * True when the headline already says everything this group's single detail
 * would repeat. "이미지에 대체 텍스트가 없습니다" followed by "Element does
 * not have an alt attribute" is one fact printed twice.
 */
export function detailIsRedundant(ruleId: string, detail: FindingDetail): boolean {
  return detail.kind === "text" && explainRule(ruleId) !== null;
}
