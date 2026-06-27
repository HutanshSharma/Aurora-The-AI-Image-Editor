const MESHES = {
  aurora:
    'radial-gradient(75% 75% at 22% 18%, #7c3aed 0%, transparent 55%),' +
    'radial-gradient(70% 70% at 82% 26%, #f43f5e 0%, transparent 55%),' +
    'radial-gradient(85% 85% at 60% 100%, #2563eb 0%, transparent 58%),' +
    'radial-gradient(55% 55% at 12% 92%, #db2777 0%, transparent 55%),' +
    'linear-gradient(160deg, #160f22, #0a0810)',
  sunset:
    'radial-gradient(70% 70% at 24% 22%, #fb923c 0%, transparent 55%),' +
    'radial-gradient(70% 70% at 82% 30%, #f43f5e 0%, transparent 55%),' +
    'radial-gradient(95% 95% at 55% 105%, #7c3aed 0%, transparent 60%),' +
    'linear-gradient(160deg, #1b1020, #0c0710)',
  teal:
    'radial-gradient(70% 70% at 28% 24%, #2dd4bf 0%, transparent 55%),' +
    'radial-gradient(70% 70% at 82% 34%, #3b82f6 0%, transparent 55%),' +
    'radial-gradient(85% 85% at 50% 105%, #6366f1 0%, transparent 60%),' +
    'linear-gradient(160deg, #0a1620, #060f18)',
  rose:
    'radial-gradient(70% 70% at 25% 25%, #fb7185 0%, transparent 55%),' +
    'radial-gradient(75% 75% at 80% 30%, #c084fc 0%, transparent 55%),' +
    'radial-gradient(90% 90% at 55% 105%, #6366f1 0%, transparent 60%),' +
    'linear-gradient(160deg, #1a1020, #0b0710)',
};

export default function MeshImage({ variant = 'aurora', className = '', style = {}, children }) {
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        backgroundImage: MESHES[variant] || MESHES.aurora,
        backgroundColor: '#0a0810',
        backgroundSize: 'cover',
        ...style,
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-white/10 via-transparent to-black/30" />
      {children}
    </div>
  );
}
