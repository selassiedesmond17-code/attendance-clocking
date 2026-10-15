import { adminLabel, userLabel, isEducation } from "@/lib/org-types";

export type DeptRole = "admin" | "assistant" | "user";
export type Power = "platform" | "admin" | "assistant";

export function deptRoleText(
  type: string,
  role: string,
  title?: string | null
) {
  if (role === "admin") return adminLabel(type);
  if (role === "assistant") return title ?? "Assistant";
  return userLabel(type);
}

export function withArticle(word: string) {
  return /^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`;
}

// The roles this person may add, given the organization type and their own power
export function addableRoles(type: string, power: Power) {
  const out: { value: string; label: string }[] = [];
  if (power === "platform") {
    out.push({ value: "admin", label: adminLabel(type) });
  }
  if (isEducation(type) && (power === "platform" || power === "admin")) {
    if (type === "university") out.push({ value: "assistant:TA", label: "TA" });
    out.push({ value: "assistant:Class Rep", label: "Class Rep" });
  }
  out.push({ value: "user", label: userLabel(type) });
  return out;
}

export function canRemove(power: Power, target: string) {
  if (power === "platform") return true;
  if (power === "admin") return target === "assistant" || target === "user";
  return target === "user";
}

export function parseRoleChoice(v: string): {
  role: DeptRole;
  title: string | null;
} {
  if (v.startsWith("assistant:")) {
    return { role: "assistant", title: v.slice("assistant:".length) };
  }
  if (v === "admin") return { role: "admin", title: null };
  return { role: "user", title: null };
}