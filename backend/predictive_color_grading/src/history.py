from dataclasses import dataclass, field
from typing import List
from .edits import Edit
MAX_EDITS = 10 

@dataclass
class EditHistory:
    base_image_path: str
    edits: List[Edit] = field(default_factory=list)

    def add_edit(self, edit: Edit):
        self.edits.append(edit)
        if len(self.edits) > MAX_EDITS:
            self.edits.pop(0)  # drop oldest

    def get_edits_after_index(self, idx: int):
        return self.edits[idx + 1 :]

    def to_dict(self):
        return {
            "base_image_path": self.base_image_path,
            "edits": [e.to_dict() for e in self.edits],
        }

    @staticmethod
    def from_dict(data):
        return EditHistory(
            base_image_path=data["base_image_path"],
            edits=[Edit.from_dict(e) for e in data["edits"]],
        )


    def get_edits_up_to_index(self, idx: int) -> list[Edit]:
        """
        Returns edits from 0..idx (inclusive).
        If idx < 0, returns an empty list.
        If idx >= len(edits), returns all edits.
        """
        if idx < 0:
            return []
        return self.edits[: idx + 1]

    def get_edits_from_index_exclusive(self, idx: int) -> list[Edit]:
        """
        Returns edits from idx+1..end.
        If idx is the last index, returns empty list.
        """
        return self.edits[idx + 1 :]
