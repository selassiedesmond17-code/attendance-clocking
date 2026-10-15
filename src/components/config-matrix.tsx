import {
  ORG_TYPES,
  FIELD_KEYS,
  adminLabel,
  fieldLabel,
  groupLabels,
  type Level,
  type ProfileConfig,
} from "@/lib/org-types";

const LEVELS: { value: Level; label: string }[] = [
  { value: "hidden", label: "Not asked" },
  { value: "optional", label: "Optional" },
  { value: "required", label: "Required" },
];

export default function ConfigMatrix({
  type,
  cfg,
}: {
  type: string;
  cfg: ProfileConfig;
}) {
  const g = groupLabels(type);
  return (
    <>
      <label className="field">
        Type of organization
        <select name="type" defaultValue={type} className="neu-input mt-1">
          {ORG_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field flex items-center gap-2">
        <input type="checkbox" name="reset_defaults" /> Load the default choices
        for the chosen type (replaces the choices below)
      </label>

      <div>
        <h2 className="text-lg font-medium">Details people must fill in</h2>
        <p className="muted mt-1 text-sm">
          Choose separately for each group. Full name and email are always
          required. Labels match the saved type, so save after changing the
          type to see the new labels.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="neu-table">
          <thead>
            <tr>
              <th>Detail</th>
              <th>{g.admin}</th>
              <th>{g.user}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Full name and email</td>
              <td className="muted">Always required</td>
              <td className="muted">Always required</td>
            </tr>
            {FIELD_KEYS.map((k) => {
              const userLabel = fieldLabel(type, k, "user");
              const admLabel = fieldLabel(type, k, "admin");
              return (
                <tr key={k}>
                  <td className="whitespace-nowrap">
                    {userLabel}
                    {admLabel !== userLabel && (
                      <span className="muted">
                        {" "}
                        / {admLabel} ({adminLabel(type).toLowerCase()}s)
                      </span>
                    )}
                  </td>
                  {(["admin", "user"] as const).map((who) => (
                    <td key={who}>
                      <select
                        name={`${who}_${k}`}
                        defaultValue={cfg[who][k]}
                        aria-label={`${userLabel} for ${who === "admin" ? g.admin : g.user}`}
                        className="neu-input"
                      >
                        {LEVELS.map((l) => (
                          <option key={l.value} value={l.value}>
                            {l.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}