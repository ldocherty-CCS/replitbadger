import type { Operator } from "@shared/schema";

const OPERATOR_COLORS = {
  local_operator: "hsl(170, 100%, 30%)",
  local_assistant: "hsl(200, 80%, 42%)",
  out_of_state: "hsl(30, 90%, 48%)",
} as const;

export function getOperatorColor(operator: Pick<Operator, "operatorType" | "isOutOfState">): string {
  if (operator.isOutOfState) return OPERATOR_COLORS.out_of_state;
  if (operator.operatorType === "assistant") return OPERATOR_COLORS.local_assistant;
  return OPERATOR_COLORS.local_operator;
}

export function getOperatorTypeLabel(type: string): string {
  return type === "assistant" ? "Assistant Operator" : "Operator";
}
