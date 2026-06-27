// Session cache for image-specific (AI-generated) LUTs — the adaptive 3D-LUT
// color grade and the Deep-WB white-balance LUT. History nodes store only a
// small { adaptive: true, adaptiveId } reference, so the heavy LUT data
// ({ size, data }) stays out of editor state / history snapshots.

const store = new Map();
let nextId = 0;

export function registerAdaptiveLUT(lut) {
  const id = ++nextId;
  store.set(id, lut);
  return id;
}

export function getAdaptiveLUTById(id) {
  return (id != null && store.get(id)) || null;
}

export function clearAdaptiveLUTs() {
  store.clear();
}
