from dataclasses import dataclass
from typing import Dict, Any

BRIGHTNESS = "brightness"
CONTRAST = "contrast"
SATURATION = "saturation"
TEMPERATURE = "temperature"
FILTER = "filter"
GRAIN = "grain"
VIGNETTE = "vignette"

@dataclass
class Edit:
    type: str
    params: Dict[str, Any]
    ai_improvable: bool = True

    def to_dict(self):
        return {
            "type": self.type,
            "params": self.params,
            "ai_improvable": self.ai_improvable,
        }

    @staticmethod
    def from_dict(data):
        return Edit(
            type=data["type"],
            params=data["params"],
            ai_improvable=data.get("ai_improvable", True),
        )
