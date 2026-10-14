import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE } from "@/lib/report-filters";
import SubmitButton from "@/components/submit-button";
import LocationFields from "@/components/location-fields";

export default async function RoomLocationPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; roomId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { orgId, roomId } = await params;
  if (!UUID_RE.test(orgId) || !UUID_RE.test(roomId)) notFound();
  const sp = await searchParams;
  const path = `/org/${orgId}/rooms/${roomId}/location`;
  const supabase = await createClient();

  const [roomRes, adminRes] = await Promise.all([
    supabase
      .from("rooms")
      .select("id, name, latitude, longitude, radius_m")
      .eq("id", roomId)
      .eq("organization_id", orgId)
      .single(),
    supabase.rpc("is_org_admin", { org: orgId }),
  ]);
  const room = roomRes.data;
  if (!room || !adminRes.data) notFound();

  async function save(formData: FormData) {
    "use server";
    const lat = parseFloat(String(formData.get("lat") ?? ""));
    const lng = parseFloat(String(formData.get("lng") ?? ""));
    const radius = parseInt(String(formData.get("radius") ?? ""), 10);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      !Number.isFinite(radius)
    ) {
      redirect(`${path}?error=${encodeURIComponent("Enter valid numbers")}`);
    }
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_room_location", {
      p_room: roomId,
      p_lat: lat,
      p_lng: lng,
      p_radius: radius,
    });
    if (error) redirect(`${path}?error=${encodeURIComponent(error.message)}`);
    redirect(`${path}?saved=1`);
  }

  const hasLocation = room.latitude !== null && room.longitude !== null;

  return (
    <main className="page max-w-md">
      <div className="neu-card flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Room location</h1>
          <span className={`neu-badge ${hasLocation ? "badge-ok" : "badge-warn"}`}>
            {hasLocation ? "set" : "not set"}
          </span>
        </div>
        <p className="muted text-sm">
          {room.name}. Sessions with the location check on compare each
          person&apos;s phone location with this point. Indoors, phones can be
          off by 20 to 100 metres, so choose a radius that fits your building.
        </p>

        {sp.saved && <p className="alert alert-ok">Location saved ✓</p>}
        {sp.error && <p className="alert alert-error">{sp.error}</p>}

        <form action={save} className="flex flex-col gap-4">
          <LocationFields
            lat={hasLocation ? String(room.latitude) : ""}
            lng={hasLocation ? String(room.longitude) : ""}
            radius={String(room.radius_m ?? 100)}
          />
          <SubmitButton
            className="neu-btn neu-btn-primary"
            pendingText="Saving…"
          >
            Save location
          </SubmitButton>
        </form>

        {hasLocation && (
          <a
            href={`https://www.google.com/maps?q=${room.latitude},${room.longitude}`}
            target="_blank"
            rel="noreferrer"
            className="neu-link text-sm"
          >
            Check this point on Google Maps
          </a>
        )}
      </div>
    </main>
  );
}