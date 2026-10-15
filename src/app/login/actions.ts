"use server";

import { createClient } from "@/lib/supabase/server";
import { ORG_TYPES, typeLabel } from "@/lib/org-types";
import {
  notifyNewRegistration,
  notifyRegistrationReceived,
} from "@/lib/notify";
import { siteUrl } from "@/lib/mail";

export type EmailStatus = "ok" | "pending" | "rejected" | "not_registered" | "error";

// Is this email registered in any organization?
export async function checkEmailAction(email: string): Promise<EmailStatus> {
  const e = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return "not_registered";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("login_status", { p_email: e });
  if (error) return "error";
  return data as EmailStatus;
}

// Register a new organization (waits for the superadmin's approval)
export async function registerAction(
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  const done = {
    ok: true,
    message:
      "Registration received. It is waiting for approval, and you cannot sign in until it is approved. We have emailed you, and we will email you again when it is decided.",
  };
  // Hidden field that only robots fill in
  if (String(formData.get("website") ?? "") !== "") return done;

  const type = String(formData.get("type") ?? "");
  if (!ORG_TYPES.some((t) => t.value === type)) {
    return { ok: false, message: "Choose an organization type" };
  }
  const orgName = String(formData.get("org_name") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_registration", {
    p_org_name: orgName,
    p_type: type,
    p_timezone: String(formData.get("timezone") ?? "UTC"),
    p_contact_name: name,
    p_email: email,
    p_phone: String(formData.get("phone") ?? ""),
  });
  if (error) return { ok: false, message: error.message };

  const site = await siteUrl();
  await Promise.all([
    notifyRegistrationReceived({ to: email, name, orgName }),
    notifyNewRegistration({
      site,
      orgName,
      typeLabel: typeLabel(type),
      by: name,
      byEmail: email,
    }),
  ]);
  return done;
}