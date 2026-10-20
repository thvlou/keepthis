/**
 * REV-04/06 — "Guardrail · Must stay" / "Guardrail · Prefer to stay" line on
 * a result issue card. Not yet mounted anywhere: the issue card itself is a
 * step 8 (Side Panel flow) deliverable.
 */

import type { GuardrailPriority } from "../../shared/types";
import { formatGuardrailPriorityLabel } from "./guardrail-copy";

export function GuardrailPriorityLabel({ priority }: { priority: GuardrailPriority }) {
  return <span>Guardrail · {formatGuardrailPriorityLabel(priority)}</span>;
}
