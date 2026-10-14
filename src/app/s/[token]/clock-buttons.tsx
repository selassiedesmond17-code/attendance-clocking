"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";

function ActionButton({
  label,
  tone,
  disabled,
  locating,
  onPress,
}: {
  label: string;
  tone: string;
  disabled: boolean;
  locating: boolean;
  onPress: () => void;
}) {
  const { pending } = useFormStatus();
  const busy = pending || locating;
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled || busy}
      className={`neu-btn neu-btn-lg ${tone}`}
    >
      {busy ? (
        <>
          <span className="spinner" aria-hidden="true" />{" "}
          {locating ? "Checking location…" : "Saving…"}
        </>
      ) : (
        label
      )}
    </button>
  );
}

export default function ClockButtons({
  clock,
  requireGps,
  canIn,
  canOut,
}: {
  clock: (formData: FormData) => void | Promise<void>;
  requireGps: boolean;
  canIn: boolean;
  canOut: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [locating, setLocating] = useState(false);

  function submitWith(action: "clock_in" | "clock_out") {
    const form = formRef.current;
    if (!form) return;
    const set = (name: string, value: string) => {
      (form.elements.namedItem(name) as HTMLInputElement).value = value;
    };
    set("action", action);
    set("lat", "");
    set("lng", "");
    set("acc", "");

    if (!requireGps || !("geolocation" in navigator)) {
      form.requestSubmit();
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set("lat", String(pos.coords.latitude));
        set("lng", String(pos.coords.longitude));
        set("acc", String(pos.coords.accuracy));
        setLocating(false);
        form.requestSubmit();
      },
      () => {
        // Denied or unavailable: the server saves it as Pending review
        setLocating(false);
        form.requestSubmit();
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  return (
    <form ref={formRef} action={clock} className="flex flex-col gap-4">
      <input type="hidden" name="action" />
      <input type="hidden" name="lat" />
      <input type="hidden" name="lng" />
      <input type="hidden" name="acc" />
      <ActionButton
        label="Clock in"
        tone="neu-btn-success"
        disabled={!canIn}
        locating={locating}
        onPress={() => submitWith("clock_in")}
      />
      <ActionButton
        label="Clock out"
        tone="neu-btn-primary"
        disabled={!canOut}
        locating={locating}
        onPress={() => submitWith("clock_out")}
      />
    </form>
  );
}