import { Upload, X } from "lucide-react";
import { uploadAndSegment, imageToBase64 } from "./SegmentationAPI";

export default function ImageUpload({setUploadedImage, handleImageUpload, closePopup, popupState, setIsSegmenting, setSegmentationImageId}){
    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const reader = new FileReader();
            reader.onload = async (event) => {
            const img = new Image();
            img.crossOrigin = "anonymous";

            img.onload = async () => {
                setUploadedImage(img);
                closePopup();

                setIsSegmenting(true);
                const imageBase64 = imageToBase64(img);

                const segmentationPromise = uploadAndSegment(imageBase64)
                    .then(result => {
                        setSegmentationImageId(result.image_id);

                        if (
                            result.compressedImage &&
                            (result.compressedWidth !== img.width ||
                            result.compressedHeight !== img.height)
                        ) {
                            const compressedImg = new Image();
                            compressedImg.src = result.compressedImage;
                            compressedImg.onload = () => {
                                setUploadedImage(compressedImg);
                            };
                        }
                    })
                    .catch(error => {
                        alert("Segmentation failed. Make sure the backend is running.");
                    })
                    .finally(() => {
                        setIsSegmenting(false);
                    });

                handleImageUpload(file).catch(error => {
                    console.error("Database upload failed:", error);
                });

                await segmentationPromise;
            };

            img.onerror = () => console.error("Failed to load uploaded image");

            img.src = event.target.result; 
            };

            reader.readAsDataURL(file);
        } catch (error) {
            console.error("Error in handleFileUpload:", error);
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
                onChange={handleFileUpload}
                className="hidden"
            />
            <button type="button" className="rounded-full" onClick={closePopup}>
                <X/>
             </button>
            </label>
        </div>
    )
}