/** REV-02~04 copy — fixed wording, priority values must not be added to (section 6). */

import type { GuardrailPriority } from "../../shared/types";

export function formatGuardrailPriorityLabel(priority: GuardrailPriority): string {
  return priority === "must" ? "Must stay" : "Prefer to stay";
}
