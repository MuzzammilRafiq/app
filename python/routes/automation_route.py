"""
Minimal input automation API for macOS using pyautogui.
All operations are blocking and atomic.
"""

import io
import time
from typing import Literal, Optional

import pyautogui
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

# Enable failsafe - moving mouse to corner will raise exception
pyautogui.FAILSAFE = True

automation_router = APIRouter()


# ============================================================================
# Request Models
# ============================================================================


class MouseMoveRequest(BaseModel):
    x: int
    y: int
    duration_ms: Optional[int] = Field(default=None, ge=0)
    delay_ms: Optional[int] = Field(
        default=0, ge=0, description="Delay before executing action"
    )


class MouseClickRequest(BaseModel):
    button: Literal["left", "right", "middle"] = "left"
    clicks: Optional[int] = Field(default=1, ge=1)
    delay_ms: Optional[int] = Field(
        default=0, ge=0, description="Delay before executing action"
    )


class KeyboardTypeRequest(BaseModel):
    text: str
    interval_ms: Optional[int] = Field(default=None, ge=0)
    delay_ms: Optional[int] = Field(
        default=0, ge=0, description="Delay before executing action"
    )


class KeyboardPressRequest(BaseModel):
    key: str
    delay_ms: Optional[int] = Field(
        default=0, ge=0, description="Delay before executing action"
    )


class SleepRequest(BaseModel):
    duration_ms: int = Field(ge=0)


# ============================================================================
# Mouse Endpoints
# ============================================================================


@automation_router.post("/mouse/move")
def mouse_move(request: MouseMoveRequest):
    """Move the mouse to the specified coordinates."""
    try:
        if request.delay_ms and request.delay_ms > 0:
            time.sleep(request.delay_ms / 1000.0)
        duration = request.duration_ms / 1000.0 if request.duration_ms else 0
        pyautogui.moveTo(request.x, request.y, duration=duration)
        return {"status": "ok", "x": request.x, "y": request.y}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@automation_router.post("/mouse/click")
def mouse_click(request: MouseClickRequest):
    """Perform a mouse click at the current position."""
    try:
        if request.delay_ms and request.delay_ms > 0:
            time.sleep(request.delay_ms / 1000.0)
        pyautogui.click(button=request.button, clicks=request.clicks or 1)
        return {"status": "ok", "button": request.button, "clicks": request.clicks or 1}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Keyboard Endpoints
# ============================================================================


@automation_router.post("/keyboard/type")
def keyboard_type(request: KeyboardTypeRequest):
    """Type the specified text."""
    try:
        if request.delay_ms and request.delay_ms > 0:
            time.sleep(request.delay_ms / 1000.0)
        interval = request.interval_ms / 1000.0 if request.interval_ms else 0
        pyautogui.typewrite(request.text, interval=interval)
        return {"status": "ok", "typed_length": len(request.text)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@automation_router.post("/keyboard/press")
def keyboard_press(request: KeyboardPressRequest):
    """Press a single key."""
    try:
        if request.delay_ms and request.delay_ms > 0:
            time.sleep(request.delay_ms / 1000.0)
        pyautogui.press(request.key)
        return {"status": "ok", "key": request.key}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Screenshot Endpoint
# ============================================================================


@automation_router.get("/screenshot")
def screenshot():
    """Capture a full-screen screenshot and return as PNG."""
    try:
        img = pyautogui.screenshot()
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)
        return Response(content=buffer.getvalue(), media_type="image/png")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Screenshot Grid Endpoint
# ============================================================================


@automation_router.get("/screenshot/grid")
def screenshot_grid(save_image: bool = False):
    """
    Capture a full-screen screenshot, cut it into 9 equal rectangles (3x3 grid),
    and return each with its screen coordinates.

    Args:
        save_image: If True, saves images locally and returns file paths.
                   If False, returns base64-encoded image data.
    """
    try:
        import base64
        import os
        from datetime import datetime

        img = pyautogui.screenshot()
        width, height = img.size

        third_width = width // 3
        third_height = height // 3

        rectangles = []
        positions = [
            ("top_left", 0, 0),
            ("top_center", 1, 0),
            ("top_right", 2, 0),
            ("middle_left", 0, 1),
            ("middle_center", 1, 1),
            ("middle_right", 2, 1),
            ("bottom_left", 0, 2),
            ("bottom_center", 1, 2),
            ("bottom_right", 2, 2),
        ]

        for name, col, row in positions:
            x1 = col * third_width
            y1 = row * third_height
            x2 = width if col == 2 else (col + 1) * third_width
            y2 = height if row == 2 else (row + 1) * third_height

            rectangles.append(
                {
                    "name": name,
                    "box": (x1, y1, x2, y2),
                    "top_left": {"x": x1, "y": y1},
                    "bottom_right": {"x": x2, "y": y2},
                }
            )

        result = {"screen_size": {"width": width, "height": height}, "rectangles": []}

        if save_image:
            save_dir = os.path.join(
                os.path.dirname(__file__), "..", "user_data", "screenshots"
            )
            os.makedirs(save_dir, exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

            for rect in rectangles:
                cropped = img.crop(rect["box"])

                rect_data = {
                    "name": rect["name"],
                    "top_left": rect["top_left"],
                    "bottom_right": rect["bottom_right"],
                }

                filename = f"{timestamp}_{rect['name']}.png"
                filepath = os.path.join(save_dir, filename)
                cropped.save(filepath, format="PNG")
                rect_data["file_path"] = filepath

                result["rectangles"].append(rect_data)
        else:
            for rect in rectangles:
                cropped = img.crop(rect["box"])

                rect_data = {
                    "name": rect["name"],
                    "top_left": rect["top_left"],
                    "bottom_right": rect["bottom_right"],
                }

                buffer = io.BytesIO()
                cropped.save(buffer, format="PNG")
                buffer.seek(0)
                rect_data["image_base64"] = base64.b64encode(buffer.getvalue()).decode(
                    "utf-8"
                )

                result["rectangles"].append(rect_data)

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Sleep Endpoint
# ============================================================================


@automation_router.post("/sleep")
def sleep_endpoint(request: SleepRequest):
    """Block execution for the specified duration."""
    try:
        duration_seconds = request.duration_ms / 1000.0
        time.sleep(duration_seconds)
        return {"status": "ok", "slept_ms": request.duration_ms}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
