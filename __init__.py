"""🐊 DRILO Workflow Library — a visual library plus a Templates section of your own.

Contributes no nodes: it exists to (a) register its example_workflows folder as
a section of the Templates browser and (b) serve the library UI.
"""

from . import library

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}
WEB_DIRECTORY = "./web"

library.bootstrap()

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
