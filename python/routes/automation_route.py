"""
Minimal input automation API for macOS using pyautogui.
All operations are blocking and atomic.
"""

import io
import time
from typing import Literal, Optional

import pyautogui
from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from PIL import Image, ImageDraw, ImageFont
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
        print(f"[DEBUG] Moving mouse to ({request.x}, {request.y})")
        if request.delay_ms and request.delay_ms > 0:
            time.sleep(request.delay_ms / 1000.0)
        duration = request.duration_ms / 1000.0 if request.duration_ms else 0
        pyautogui.moveTo(request.x, request.y, duration=duration)
        return {"status": "ok", "x": request.x, "y": request.y}
    except Exception as e:
        print(f"[ERROR] Mouse move failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@automation_router.post("/mouse/click")
def mouse_click(request: MouseClickRequest):
    """Perform a mouse click at the current position."""
    try:
        print(f"[DEBUG] Clicking mouse: {request.button}, clicks={request.clicks}")
        if request.delay_ms and request.delay_ms > 0:
            time.sleep(request.delay_ms / 1000.0)
        pyautogui.click(button=request.button, clicks=request.clicks or 1)
        return {"status": "ok", "button": request.button, "clicks": request.clicks or 1}
    except Exception as e:
        print(f"[ERROR] Mouse click failed: {e}")
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
def screenshot(save_image: bool = False):
    """
    Capture a full-screen screenshot and return as PNG.

    Args:
        save_image: If True, saves image locally and returns file path.
                   If False, returns the PNG image directly.
    """
    try:
        import base64
        import os
        from datetime import datetime

        img = pyautogui.screenshot()
        width, height = img.size

        # Always prepare buffer for base64
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)
        
        # If not saving image, return direct response
        if not save_image:
            return Response(content=buffer.getvalue(), media_type="image/png")
            
        # If saving image, prepare JSON response with both path and base64 (if needed by client logic, though client typically uses one or other)
        # But wait, the standard /screenshot returns binary data typically. 
        # For consistency with other JSON endpoints, if save_image=True, we return JSON.
        
        save_dir = os.path.join(
            os.path.dirname(__file__), "..", "user_data", "screenshots"
        )
        os.makedirs(save_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{timestamp}_screenshot.png"
        filepath = os.path.join(save_dir, filename)
        img.save(filepath, format="PNG")
        
        return {
            "screen_size": {"width": width, "height": height},
            "file_path": filepath,
            "base64": base64.b64encode(buffer.getvalue()).decode("utf-8")
        }
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
        
        save_dir = None
        timestamp = None
        
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

            # Generate base64
            buffer = io.BytesIO()
            cropped.save(buffer, format="PNG")
            buffer.seek(0)
            rect_data["image_base64"] = base64.b64encode(buffer.getvalue()).decode("utf-8")

            # Save to disk if requested
            if save_image:
                filename = f"{timestamp}_{rect['name']}.png"
                filepath = os.path.join(save_dir, filename)
                cropped.save(filepath, format="PNG")
                rect_data["file_path"] = filepath

            result["rectangles"].append(rect_data)

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Image Grid Endpoint (Upload)
# ============================================================================


@automation_router.post("/image/numbered-grid")
async def image_numbered_grid(
    image: UploadFile = File(..., description="Image file to process"),
    grid_size: int = Query(default=3, ge=2, le=10, description="Grid size n for n×n grid (2-10)"),
    save_image: bool = Query(default=False)
):
    """
    Accept an uploaded image and create an n×n grid overlay with numbered cells.

    Args:
        image: Uploaded image file (PNG, JPG, etc.)
        grid_size: Integer between 2 and 10 for n×n grid.
        save_image: If True, saves images locally and returns file paths.
                   If False, returns base64-encoded image data.

    Returns:
        - original_image: The unmodified uploaded image
        - grid_image: Image with grid lines and cell numbers (1 to n×n)
        - image_size: Width and height of the image
    """
    try:
        import base64
        import os
        from datetime import datetime

        contents = await image.read()
        img = Image.open(io.BytesIO(contents))
        if img.mode != "RGB":
            img = img.convert("RGB")
        width, height = img.size

        grid_img = img.copy().convert("RGBA")
        overlay = Image.new("RGBA", grid_img.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)

        cell_width = width / grid_size
        cell_height = height / grid_size

        line_color = (255, 0, 0, 255)
        outline_color = (0, 0, 0, 255)
        
        reference_diagonal = 2200
        current_diagonal = (width ** 2 + height ** 2) ** 0.5
        scale_factor = max(0.3, min(1.5, current_diagonal / reference_diagonal))
        
        line_width = max(2, int(10 * scale_factor))
        outline_width = max(1, int(2 * scale_factor))
        text_outline_range = max(1, int(4 * scale_factor))

        for i in range(1, grid_size):
            x = int(i * cell_width)
            draw.line([(x, 0), (x, height)], fill=outline_color, width=line_width + outline_width * 2)
        for i in range(1, grid_size):
            x = int(i * cell_width)
            draw.line([(x, 0), (x, height)], fill=line_color, width=line_width)

        for i in range(1, grid_size):
            y = int(i * cell_height)
            draw.line([(0, y), (width, y)], fill=outline_color, width=line_width + outline_width * 2)
        for i in range(1, grid_size):
            y = int(i * cell_height)
            draw.line([(0, y), (width, y)], fill=line_color, width=line_width)

        draw.rectangle([(0, 0), (width - 1, height - 1)], outline=outline_color, width=line_width + outline_width * 2)
        draw.rectangle([(outline_width, outline_width), (width - 1 - outline_width, height - 1 - outline_width)], outline=line_color, width=line_width)

        font_size = int(min(cell_width, cell_height) * 0.6)
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
        except:
            try:
                font = ImageFont.truetype("/System/Library/Fonts/SFNSMono.ttf", font_size)
            except:
                font = ImageFont.load_default()

        text_color = (255, 255, 255, 100)
        outline_text_color = (0, 0, 0, 200)

        cell_number = 1
        for row in range(grid_size):
            for col in range(grid_size):
                cell_center_x = int(col * cell_width + cell_width / 2)
                cell_center_y = int(row * cell_height + cell_height / 2)

                text = str(cell_number)
                bbox = draw.textbbox((0, 0), text, font=font)
                text_width = bbox[2] - bbox[0]
                text_height = bbox[3] - bbox[1]

                text_x = cell_center_x - text_width // 2
                text_y = cell_center_y - text_height // 2

                text_outline_offsets = list(range(-text_outline_range, text_outline_range + 1))
                for dx in text_outline_offsets:
                    for dy in text_outline_offsets:
                        if dx != 0 or dy != 0:
                            draw.text((text_x + dx, text_y + dy), text, font=font, fill=outline_text_color)

                draw.text((text_x, text_y), text, font=font, fill=text_color)
                cell_number += 1

        grid_img = Image.alpha_composite(grid_img, overlay).convert("RGB")

        result = {
            "image_size": {"width": width, "height": height},
            "grid_size": grid_size,
            "total_cells": grid_size * grid_size,
        }

        # Generate Base64
        original_buffer = io.BytesIO()
        img.save(original_buffer, format="PNG")
        original_buffer.seek(0)
        result["original_image_base64"] = base64.b64encode(original_buffer.getvalue()).decode("utf-8")

        grid_buffer = io.BytesIO()
        grid_img.save(grid_buffer, format="PNG")
        grid_buffer.seek(0)
        result["grid_image_base64"] = base64.b64encode(grid_buffer.getvalue()).decode("utf-8")

        if save_image:
            save_dir = os.path.join(
                os.path.dirname(__file__), "..", "user_data", "screenshots"
            )
            os.makedirs(save_dir, exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

            original_filename = f"{timestamp}_uploaded_original.png"
            original_filepath = os.path.join(save_dir, original_filename)
            img.save(original_filepath, format="PNG")
            result["original_image_path"] = original_filepath

            grid_filename = f"{timestamp}_uploaded_grid_{grid_size}x{grid_size}.png"
            grid_filepath = os.path.join(save_dir, grid_filename)
            grid_img.save(grid_filepath, format="PNG")
            result["grid_image_path"] = grid_filepath

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Screenshot Numbered Grid Endpoint
# ============================================================================


@automation_router.get("/screenshot/numbered-grid")
def screenshot_numbered_grid(
    grid_size: int = Query(default=3, ge=2, le=10, description="Grid size n for n×n grid (2-10)"),
    save_image: bool = False
):
    """
    Capture a full-screen screenshot and create an n×n grid overlay with numbered cells.

    Args:
        grid_size: Integer between 2 and 10 for n×n grid.
        save_image: If True, saves images locally and returns file paths.
                   If False, returns base64-encoded image data.

    Returns:
        - original_image: The unmodified screenshot
        - grid_image: Screenshot with grid lines and cell numbers (1 to n×n)
        - image_size: Width and height of the image
    """
    try:
        import base64
        import os
        from datetime import datetime

        img = pyautogui.screenshot()
        width, height = img.size

        grid_img = img.copy().convert("RGBA")
        overlay = Image.new("RGBA", grid_img.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)

        cell_width = width / grid_size
        cell_height = height / grid_size

        line_color = (255, 0, 0, 255)
        outline_color = (0, 0, 0, 255)
        
        reference_diagonal = 2200
        current_diagonal = (width ** 2 + height ** 2) ** 0.5
        scale_factor = max(0.3, min(1.5, current_diagonal / reference_diagonal))
        
        line_width = max(2, int(10 * scale_factor))
        outline_width = max(1, int(2 * scale_factor))
        text_outline_range = max(1, int(4 * scale_factor))

        for i in range(1, grid_size):
            x = int(i * cell_width)
            draw.line([(x, 0), (x, height)], fill=outline_color, width=line_width + outline_width * 2)
        for i in range(1, grid_size):
            x = int(i * cell_width)
            draw.line([(x, 0), (x, height)], fill=line_color, width=line_width)

        for i in range(1, grid_size):
            y = int(i * cell_height)
            draw.line([(0, y), (width, y)], fill=outline_color, width=line_width + outline_width * 2)
        for i in range(1, grid_size):
            y = int(i * cell_height)
            draw.line([(0, y), (width, y)], fill=line_color, width=line_width)

        draw.rectangle([(0, 0), (width - 1, height - 1)], outline=outline_color, width=line_width + outline_width * 2)
        draw.rectangle([(outline_width, outline_width), (width - 1 - outline_width, height - 1 - outline_width)], outline=line_color, width=line_width)

        font_size = int(min(cell_width, cell_height) * 0.6)
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
        except:
            try:
                font = ImageFont.truetype("/System/Library/Fonts/SFNSMono.ttf", font_size)
            except:
                font = ImageFont.load_default()

        text_color = (255, 255, 255, 100)
        outline_text_color = (0, 0, 0, 200)

        cell_number = 1
        for row in range(grid_size):
            for col in range(grid_size):
                cell_center_x = int(col * cell_width + cell_width / 2)
                cell_center_y = int(row * cell_height + cell_height / 2)

                text = str(cell_number)
                bbox = draw.textbbox((0, 0), text, font=font)
                text_width = bbox[2] - bbox[0]
                text_height = bbox[3] - bbox[1]

                text_x = cell_center_x - text_width // 2
                text_y = cell_center_y - text_height // 2

                text_outline_offsets = list(range(-text_outline_range, text_outline_range + 1))
                for dx in text_outline_offsets:
                    for dy in text_outline_offsets:
                        if dx != 0 or dy != 0:
                            draw.text((text_x + dx, text_y + dy), text, font=font, fill=outline_text_color)

                draw.text((text_x, text_y), text, font=font, fill=text_color)
                cell_number += 1

        grid_img = Image.alpha_composite(grid_img, overlay).convert("RGB")

        result = {
            "image_size": {"width": width, "height": height},
            "screen_size": {"width": pyautogui.size().width, "height": pyautogui.size().height},
            "scale_factor": width / pyautogui.size().width,
            "grid_size": grid_size,
            "total_cells": grid_size * grid_size,
        }
        
        print(f"[DEBUG] Screenshot taken: Image({width}x{height}), Screen({pyautogui.size().width}x{pyautogui.size().height}), Scale({width / pyautogui.size().width})")

        # Generate Base64 for original
        original_buffer = io.BytesIO()
        img.save(original_buffer, format="PNG")
        original_buffer.seek(0)
        result["original_image_base64"] = base64.b64encode(original_buffer.getvalue()).decode("utf-8")

        # Generate Base64 for grid
        grid_buffer = io.BytesIO()
        grid_img.save(grid_buffer, format="PNG")
        grid_buffer.seek(0)
        result["grid_image_base64"] = base64.b64encode(grid_buffer.getvalue()).decode("utf-8")

        if save_image:
            save_dir = os.path.join(
                os.path.dirname(__file__), "..", "user_data", "screenshots"
            )
            os.makedirs(save_dir, exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

            original_filename = f"{timestamp}_original.png"
            original_filepath = os.path.join(save_dir, original_filename)
            img.save(original_filepath, format="PNG")
            result["original_image_path"] = original_filepath

            grid_filename = f"{timestamp}_grid_{grid_size}x{grid_size}.png"
            grid_filepath = os.path.join(save_dir, grid_filename)
            grid_img.save(grid_filepath, format="PNG")
            result["grid_image_path"] = grid_filepath

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Image Crop Cell Endpoint
# ============================================================================


class CropCellRequest(BaseModel):
    cell_number: int = Field(ge=1, description="Cell number (1-based)")
    grid_size: int = Field(default=6, ge=2, le=10, description="Grid size n for n×n grid")
    create_sub_grid: bool = Field(default=True, description="Whether to create sub-grid overlay on cropped cell")
    sub_grid_size: int = Field(default=6, ge=2, le=10, description="Sub-grid size for cropped cell")


@automation_router.post("/image/crop-cell")
async def image_crop_cell(
    image: UploadFile = File(..., description="Image file to process"),
    cell_number: int = Query(..., ge=1, description="Cell number (1-based)"),
    grid_size: int = Query(default=6, ge=2, le=10, description="Grid size n for n×n grid"),
    create_sub_grid: bool = Query(default=True, description="Whether to create sub-grid overlay"),
    sub_grid_size: int = Query(default=6, ge=2, le=10, description="Sub-grid size"),
    save_image: bool = Query(default=False, description="Whether to save the cropped image for debugging")
):
    """
    Crop a specific cell from an image and optionally create a sub-grid overlay.
    
    Args:
        image: Uploaded image file
        cell_number: Cell number to crop (1-based, left-to-right, top-to-bottom)
        grid_size: Original grid size
        create_sub_grid: Whether to overlay a new grid on the cropped cell
        sub_grid_size: Size of sub-grid to create on cropped cell
        save_image: If True, saves images locally
    
    Returns:
        - cropped_image: The cropped cell (with optional sub-grid)
        - cell_bounds: Original image coordinates of the cell
    """
    try:
        import base64
        import os
        from datetime import datetime
        
        if cell_number > grid_size * grid_size:
            raise HTTPException(
                status_code=400, 
                detail=f"Cell number {cell_number} exceeds grid size {grid_size}x{grid_size}"
            )
        
        contents = await image.read()
        img = Image.open(io.BytesIO(contents))
        if img.mode != "RGB":
            img = img.convert("RGB")
        width, height = img.size
        
        cell_width = width / grid_size
        cell_height = height / grid_size
        
        row = (cell_number - 1) // grid_size
        col = (cell_number - 1) % grid_size
        
        x1 = int(col * cell_width)
        y1 = int(row * cell_height)
        x2 = int((col + 1) * cell_width) if col < grid_size - 1 else width
        y2 = int((row + 1) * cell_height) if row < grid_size - 1 else height
        
        cropped = img.crop((x1, y1, x2, y2))
        cropped_width, cropped_height = cropped.size
        
        result = {
            "cell_bounds": {
                "x1": x1, "y1": y1, "x2": x2, "y2": y2,
                "width": x2 - x1, "height": y2 - y1
            },
            "original_size": {"width": width, "height": height},
            "cropped_size": {"width": cropped_width, "height": cropped_height}
        }
        
        if create_sub_grid:
            grid_img = cropped.copy().convert("RGBA")
            overlay = Image.new("RGBA", grid_img.size, (0, 0, 0, 0))
            draw = ImageDraw.Draw(overlay)
            
            sub_cell_width = cropped_width / sub_grid_size
            sub_cell_height = cropped_height / sub_grid_size
            
            line_color = (255, 0, 0, 255)
            outline_color = (0, 0, 0, 255)
            
            reference_diagonal = 2200
            current_diagonal = (cropped_width ** 2 + cropped_height ** 2) ** 0.5
            scale_factor = max(0.3, min(1.5, current_diagonal / reference_diagonal))
            
            line_width = max(2, int(10 * scale_factor))
            outline_width = max(1, int(2 * scale_factor))
            text_outline_range = max(1, int(4 * scale_factor))
            
            for i in range(1, sub_grid_size):
                x = int(i * sub_cell_width)
                draw.line([(x, 0), (x, cropped_height)], fill=outline_color, width=line_width + outline_width * 2)
            for i in range(1, sub_grid_size):
                x = int(i * sub_cell_width)
                draw.line([(x, 0), (x, cropped_height)], fill=line_color, width=line_width)
            
            for i in range(1, sub_grid_size):
                y = int(i * sub_cell_height)
                draw.line([(0, y), (cropped_width, y)], fill=outline_color, width=line_width + outline_width * 2)
            for i in range(1, sub_grid_size):
                y = int(i * sub_cell_height)
                draw.line([(0, y), (cropped_width, y)], fill=line_color, width=line_width)
            
            draw.rectangle([(0, 0), (cropped_width - 1, cropped_height - 1)], outline=outline_color, width=line_width + outline_width * 2)
            draw.rectangle([(outline_width, outline_width), (cropped_width - 1 - outline_width, cropped_height - 1 - outline_width)], outline=line_color, width=line_width)
            
            font_size = int(min(sub_cell_width, sub_cell_height) * 0.6)
            try:
                font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
            except:
                try:
                    font = ImageFont.truetype("/System/Library/Fonts/SFNSMono.ttf", font_size)
                except:
                    font = ImageFont.load_default()
            
            text_color = (255, 255, 255, 100)
            outline_text_color = (0, 0, 0, 200)
            
            cell_num = 1
            for r in range(sub_grid_size):
                for c in range(sub_grid_size):
                    center_x = int(c * sub_cell_width + sub_cell_width / 2)
                    center_y = int(r * sub_cell_height + sub_cell_height / 2)
                    
                    text = str(cell_num)
                    bbox = draw.textbbox((0, 0), text, font=font)
                    text_w = bbox[2] - bbox[0]
                    text_h = bbox[3] - bbox[1]
                    
                    text_x = center_x - text_w // 2
                    text_y = center_y - text_h // 2
                    
                    offsets = list(range(-text_outline_range, text_outline_range + 1))
                    for dx in offsets:
                        for dy in offsets:
                            if dx != 0 or dy != 0:
                                draw.text((text_x + dx, text_y + dy), text, font=font, fill=outline_text_color)
                    
                    draw.text((text_x, text_y), text, font=font, fill=text_color)
                    cell_num += 1
            
            grid_img = Image.alpha_composite(grid_img, overlay).convert("RGB")
            
            # Generate Base64 for CLEAN cropped image (without grid)
            clean_buffer = io.BytesIO()
            cropped.save(clean_buffer, format="PNG")
            clean_buffer.seek(0)
            result["clean_cropped_image_base64"] = base64.b64encode(clean_buffer.getvalue()).decode("utf-8")
            
            # Generate Base64 for GRID cropped image (with grid overlay)
            buffer = io.BytesIO()
            grid_img.save(buffer, format="PNG")
            buffer.seek(0)
            result["cropped_image_base64"] = base64.b64encode(buffer.getvalue()).decode("utf-8")
            result["sub_grid_size"] = sub_grid_size

            # Save if requested
            if save_image:
                save_dir = os.path.join(
                    os.path.dirname(__file__), "..", "user_data", "screenshots"
                )
                os.makedirs(save_dir, exist_ok=True)
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                
                filename = f"{timestamp}_cropped_cell_{cell_number}.png"
                filepath = os.path.join(save_dir, filename)
                grid_img.save(filepath, format="PNG")
                result["cropped_image_path"] = filepath
            
        else:
            # Generate Base64
            buffer = io.BytesIO()
            cropped.save(buffer, format="PNG")
            buffer.seek(0)
            result["cropped_image_base64"] = base64.b64encode(buffer.getvalue()).decode("utf-8")
            
            # Save if requested
            if save_image:
                save_dir = os.path.join(
                    os.path.dirname(__file__), "..", "user_data", "screenshots"
                )
                os.makedirs(save_dir, exist_ok=True)
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                
                filename = f"{timestamp}_cropped_cell_{cell_number}_raw.png"
                filepath = os.path.join(save_dir, filename)
                cropped.save(filepath, format="PNG")
                result["cropped_image_path"] = filepath
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Grid Cell Center Endpoint
# ============================================================================


@automation_router.get("/grid/cell-center")
def grid_cell_center(
    width: int = Query(..., ge=1, description="Image/screen width"),
    height: int = Query(..., ge=1, description="Image/screen height"),
    grid_size: int = Query(..., ge=2, le=10, description="Grid size n for n×n grid"),
    cell_number: int = Query(..., ge=1, description="Cell number (1-based)"),
    offset_x: int = Query(default=0, description="X offset for nested cells"),
    offset_y: int = Query(default=0, description="Y offset for nested cells")
):
    """
    Calculate the center coordinates of a grid cell.
    
    For nested cells (two-pass refinement), use offset_x and offset_y to specify
    the top-left corner of the parent cell in screen coordinates.
    
    Args:
        width: Width of the image/region
        height: Height of the image/region
        grid_size: Grid size (n for n×n grid)
        cell_number: Cell number (1-based, left-to-right, top-to-bottom)
        offset_x: X offset for the region in screen coordinates
        offset_y: Y offset for the region in screen coordinates
    
    Returns:
        Center coordinates {x, y} in screen coordinates
    """
    try:
        if cell_number > grid_size * grid_size:
            raise HTTPException(
                status_code=400,
                detail=f"Cell number {cell_number} exceeds grid size {grid_size}x{grid_size}"
            )
        
        cell_width = width / grid_size
        cell_height = height / grid_size
        
        row = (cell_number - 1) // grid_size
        col = (cell_number - 1) % grid_size
        
        center_x = int(offset_x + col * cell_width + cell_width / 2)
        center_y = int(offset_y + row * cell_height + cell_height / 2)
        
        return {
            "x": center_x,
            "y": center_y,
            "cell_number": cell_number,
            "cell_bounds": {
                "x1": int(offset_x + col * cell_width),
                "y1": int(offset_y + row * cell_height),
                "x2": int(offset_x + (col + 1) * cell_width),
                "y2": int(offset_y + (row + 1) * cell_height)
            }
        }
    except HTTPException:
        raise
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
