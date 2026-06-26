import { forwardRef } from 'react';
import { Wand2 } from 'lucide-react';

const DropBox = forwardRef((_, ref) => {
  return (
    <div
      ref={ref}
      className="absolute right-4 top-24 z-40 flex w-52 flex-col items-center justify-center gap-2.5
                 rounded-2xl border-2 border-dashed border-accent/50 bg-accent-soft p-5 text-center
                 glass shadow-glow transition-colors duration-300 hover:border-accent"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/20 text-accent">
        <Wand2 size={24} />
      </div>
      <p className="text-[13px] leading-snug text-ink/90">
        Drop here to edit the cut-out
      </p>
    </div>
  );
});

DropBox.displayName = 'DropBox';

export default DropBox;
