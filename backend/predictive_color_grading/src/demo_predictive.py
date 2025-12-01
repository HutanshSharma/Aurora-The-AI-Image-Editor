from src.edits import Edit, BRIGHTNESS, CONTRAST
from src.history import EditHistory
from src.predictive_branch import run_predictive_branch
from src.branching import render_original_future_branch
from src.apply_edits import save_image


def build_history() -> EditHistory:
    """
    Build a demo history on top of a chosen base image.
    Change 'my_test.jpg' to any filename you want to test.
    """
    hist = EditHistory(base_image_path="my_test.jpg")

    # Simulated user edits:
    hist.add_edit(Edit(BRIGHTNESS, {"value": 0.2}))
    hist.add_edit(Edit(CONTRAST,   {"value": 0.3}))
    hist.add_edit(Edit(BRIGHTNESS, {"value": 0.1}))
    hist.add_edit(Edit(CONTRAST,   {"value": 0.15}))

    return hist


def main():
    history = build_history()

    # User-selected branch: after the 2nd edit (index 1)
    slide_index = 1

    # --- 1) AI-predicted future from that branch ---
    ai_full, ai_params, future_edits = run_predictive_branch(history, slide_index)
    save_image(ai_full, f"ai_from_slide_{slide_index}.jpg")

    print("AI Params:", ai_params)
    print("Future edits:", future_edits)

    # --- 2) User-only future from that same branch (baseline) ---
    user_future_img, _ = render_original_future_branch(history, slide_index)
    save_image(user_future_img, f"user_future_from_{slide_index}.jpg")


if __name__ == "__main__":
    main()
