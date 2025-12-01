
from .edits import Edit, BRIGHTNESS, CONTRAST, SATURATION, FILTER
from .history import EditHistory
from .branching import (
    render_slide_image,
    render_original_future_branch,
)
from .apply_edits import save_image


def build_dummy_history() -> EditHistory:
    base_path = "example.jpg"  # your base image

    hist = EditHistory(base_image_path=base_path)

    # Simulate a user doing 4 edits in sequence
    hist.add_edit(Edit(BRIGHTNESS, {"value": 0.2}))
    hist.add_edit(Edit(CONTRAST,   {"value": 0.3}))
    hist.add_edit(Edit(SATURATION, {"value": 0.25}))
    hist.add_edit(Edit(FILTER,     {"id": "WarmFilm03", "strength": 0.7}))

    return hist


def main():
    history = build_dummy_history()

    # Let's pretend the user clicks on slide index 1
    # (after brightness & contrast, but before saturation & filter)
    slide_idx = 1

    # 1) Image at that slide
    img_at_slide = render_slide_image(history, slide_idx)
    save_image(img_at_slide, f"output_slide_{slide_idx}.jpg")

    # 2) Original future branch from that slide
    future_img, future_edits = render_original_future_branch(history, slide_idx)
    save_image(future_img, f"output_future_from_{slide_idx}.jpg")

    print(f"Slide {slide_idx} -> future edits:")
    for e in future_edits:
        print(e)


if __name__ == "__main__":
    main()
