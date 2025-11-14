import { Upload, X } from "lucide-react";

export default function ImageUpload({setUploadedImage, setAllImages, simulateAISegmentation, closePopup, popupState}){
    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
            setUploadedImage(img);
            setAllImages(prev=>[...prev, img])
            simulateAISegmentation(img);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
        closePopup()
        }
    };

    return (
        <div className="absolute right-[50%] flex items-center justify-center h-[600px]">
            <label className={`popup ${popupState} rounded-2xl`} id="popup">
            <div className="bg-white/5 border-2 border-dashed border-white/20 rounded-2xl p-12 hover:bg-white/10 hover:border-blue-400 transition-all">
                <Upload size={64} className="mx-auto mb-4 text-blue-400 group-hover:scale-110 transition-transform" />
                <p className="text-xl font-semibold mb-2">Upload an Image</p>
                <p className="text-sm text-gray-400">Click to browse or drag and drop</p>
            </div>
            <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
            />
            <button type="button" className="rounded-full" onClick={closePopup}>
                <X/>
             </button>
            </label>
        </div>
    )
}