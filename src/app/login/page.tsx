import LoginClient from "./login-client";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  return (
    <LoginClient initialTab={sp.tab === "register" ? "register" : "login"} />
  );
}