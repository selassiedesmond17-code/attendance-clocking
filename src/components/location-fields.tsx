"use client";

import { useState } from "react";

export default function LocationFields({
  lat,
  lng,
  radius,
}: {
  lat: string;
  lng: string;
  radius: string;
}) {
  const [la, setLa] = useState(lat);
  const [lo, setLo] = useState(lng);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  function fillFromHere() {
    if (!("geolocation" in navigator)) {
      setMsg("Location is not available in this browser.");
      return;
    }
    setBusy(true);
    setMsg("");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLa(p.coords.latitude.toFixed(6));
        setLo(p.coords.longitude.toFixed(6));
        setMsg(
          `Location found, accurate to about ${Math.round(
            p.coords.accuracy
          )} m. For best results, stand in the middle of the room.`
        );
        setBusy(false);
      },
      () => {
        setMsg(
          "Could not get your location. Allow location access, or type the numbers in."
        );
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={fillFromHere}
        disabled={busy}
        className="neu-btn"
      >
        {busy ? (
          <>
            <span className="spinner" aria-hidden="true" /> Finding you…
          </>
        ) : (
          "Use my current location"
        )}
      </button>
      {msg && <p className="alert alert-info">{msg}</p>}
      <div className="grid grid-cols-2 gap-3">
        <label className="field">
          Latitude
          <input
            name="lat"
            required
            inputMode="decimal"
            value={la}
            onChange={(e) => setLa(e.target.value)}
            placeholder="5.603700"
            className="neu-input mt-1"
          />
        </label>
        <label className="field">
          Longitude
          <input
            name="lng"
            required
            inputMode="decimal"
            value={lo}
            onChange={(e) => setLo(e.target.value)}
            placeholder="-0.187000"
            className="neu-input mt-1"
          />
        </label>
      </div>
      <label className="field">
        Allowed radius (metres)
        <input
          name="radius"
          type="number"
          required
          min={10}
          max={5000}
          defaultValue={radius}
          className="neu-input mt-1"
        />
      </label>
    </>
  );
}