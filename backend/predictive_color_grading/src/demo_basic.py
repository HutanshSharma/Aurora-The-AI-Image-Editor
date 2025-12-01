from src.edits import Edit, BRIGHTNESS, CONTRAST, SATURATION, FILTER
from src.history import EditHistory
from src.apply_edits import load_image, save_image, apply_edits_sequence

def main():
    base_path = "example.jpg"

    hist = EditHistory(base_image_path=base_path)

    hist.add_edit(Edit(BRIGHTNESS, {"value": 0.2}))
    hist.add_edit(Edit(CONTRAST,   {"value": 0.3}))
    hist.add_edit(Edit(SATURATION, {"value": 0.25}))
    hist.add_edit(Edit(FILTER,     {"id": "WarmFilm03", "strength": 0.7}))

    img = load_image(hist.base_image_path)
    out = apply_edits_sequence(img, hist.edits)
    save_image(out, "output_demo.jpg")

if __name__ == "__main__":
    main()
