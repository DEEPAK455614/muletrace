// Active-dataset scope: triage and audit storage are namespaced per dataset so
// uploaded data never inherits annotations made on the synthetic fixture (or a
// different upload), even when account ids collide.
let active = 'synthetic';
export function setActiveDatasetScope(scope: string) { active = scope; }
export function scopedKey(base: string): string { return `${base}.${active}`; }
