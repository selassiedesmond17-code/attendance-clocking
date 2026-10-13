"use client";

import { useFormStatus } from "react-dom";

export default function SubmitButton({
  children,
  pendingText = "Working…",
  className = "neu-btn",
  ...props
}: React.ComponentProps<"button"> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      {...props}
      className={className}
      disabled={pending || props.disabled}
      aria-busy={pending}
    >
      {pending ? (
        <>
          <span className="spinner" aria-hidden="true" /> {pendingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}