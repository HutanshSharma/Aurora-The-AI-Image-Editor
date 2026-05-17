import { forwardRef } from "react";
import { Sliders } from "lucide-react";

const DropBox = forwardRef(({}, ref) => {
  return (
    <div
      ref={ref}
      className="
        absolute top-28 right-4 z-40
        bg-linear-to-br from-blue-500/10 to-indigo-500/10
        border border-blue-400/50 rounded-2xl
        backdrop-blur-md shadow-lg
        p-5 w-56
        flex flex-col items-center justify-center
        transition-all duration-300 hover:border-blue-400 hover:shadow-blue-500/30
      "
    >
      <Sliders size={36} className="text-blue-400 mb-2" />
      <p className="text-[13px] text-blue-200 text-center mb-2">
        Drop here to edit the segmented part
      </p>
    </div>
  );
});

export default DropBox;
