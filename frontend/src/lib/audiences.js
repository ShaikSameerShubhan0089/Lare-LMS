// Who a curriculum module (and its materials) targets. The value is stored on
// the module as `branch_scope`; the student roadmap shows a module when it is
// "all", the student's branch category, or the student's exact branch code.
// Codes match the seeded branches (engineering + degree).
export const AUDIENCE_GROUPS = [
  {
    label: "Everyone",
    options: [{ value: "all", label: "All students" }],
  },
  {
    label: "Engineering — by branch",
    options: [
      { value: "CSE", label: "CSE" },
      { value: "ECE", label: "ECE" },
      { value: "EEE", label: "EEE" },
      { value: "AIDS", label: "AI & Data Science" },
      { value: "CSE-AI", label: "CSE — AI" },
      { value: "CSE-DS", label: "CSE — Data Science" },
    ],
  },
  {
    label: "Engineering — grouped",
    options: [
      { value: "cse_allied", label: "All CSE & AI branches" },
      { value: "core", label: "All Core (ECE / EEE)" },
    ],
  },
  {
    label: "Degree — by branch",
    options: [
      { value: "BSC-COMP", label: "BSc Computers" },
      { value: "BSC-AI", label: "BSc AI" },
      { value: "BSC-MPC", label: "BSc MPC" },
      { value: "BZC", label: "BZC" },
    ],
  },
];

const _LABELS = Object.fromEntries(
  AUDIENCE_GROUPS.flatMap((g) => g.options.map((o) => [o.value, o.label])),
);

export function audienceLabel(value) {
  return _LABELS[value] || value || "—";
}
