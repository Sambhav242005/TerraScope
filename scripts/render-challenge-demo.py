"""Compose the TerraScope landscape cut from recorded footage and the preview audio."""
import argparse
import json
import re
import shutil
import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_WORK = ROOT / "artifacts" / "challenge-demo"
DEMO = ROOT / "demo"
DURATION = 78
WIDTH, HEIGHT = 1920, 1080
APP_X, APP_Y, APP_W, APP_H = 160, 104, 1600, 720
LABEL_Y = 64
CAPTION_BOX = (360, 826, 1560, 916)
BACKGROUND = "0x102625"

ASS_HEADER = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Text,Segoe UI,32,&H00F4FAF4,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def run_ffmpeg(*args, **kwargs):
    return subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", *map(str, args)],
        check=True, **kwargs,
    )


def ass_time(seconds):
    cs = round(seconds * 100)
    return f"{cs // 360000}:{cs // 6000 % 60:02}:{cs // 100 % 60:02}.{cs % 100:02}"


def timestamp(value):
    hours, minutes, seconds = value.split(":")
    return 3600 * int(hours) + 60 * int(minutes) + float(seconds)


def captions(path):
    content = path.read_text(encoding="utf-8-sig").strip().splitlines()
    if not content or content[0] != "WEBVTT":
        raise ValueError("Expected a WebVTT caption file")
    cues = []
    for block in re.split(r"\n\s*\n", "\n".join(content[1:]).strip()):
        times, *lines = block.splitlines()
        start_time, _, end_time, *_settings = times.split()
        start, end = timestamp(start_time), timestamp(end_time)
        if not 0 <= start < end <= DURATION or (cues and start < cues[-1][1]):
            raise ValueError(f"Invalid or overlapping caption at {times}")
        if not 1 <= len(lines) <= 2 or any(not 1 <= len(line) <= 40 for line in lines):
            raise ValueError(f"Caption exceeds 2 lines or 40 characters per line at {times}")
        cues.append((start, end, lines))
    return cues


def event(layer, start, end, content):
    return f"Dialogue: {layer},{ass_time(start)},{ass_time(end)},Text,,0,0,0,,{content}\n"


def text(start, end, x, y, value, size, *, color="F4FAF4", alignment=7, bold=False):
    ass_color = color[4:6] + color[2:4] + color[:2]
    weight = -1 if bold else 0
    markup = rf"{{\an{alignment}\pos({x},{y})\fs{size}\1c&H{ass_color}&\b{weight}}}"
    return event(2, start, end, markup + value)


def box(start, end, bounds, color):
    x, y, right, bottom = bounds
    width, height = right - x, bottom - y
    ass_color = color[4:6] + color[2:4] + color[:2]
    markup = rf"{{\an7\pos({x},{y})\1c&H{ass_color}&\p1}}"
    return event(1, start, end, f"{markup}m 0 0 l {width} 0 {width} {height} 0 {height}")


def overlays(cues, preview):
    events = [ASS_HEADER]
    chapters = [
        (0, 3, "Where could floodwater go?"),
        (3, 10, "Public app footage · Sonepur, Bihar"),
        (10, 23, "Public app footage · Historical replay"),
        (23, 33, "Public app footage · Screen for terrain depressions"),
        (33, 45, "Public app footage · Open one candidate"),
        (45, 55, "Public app footage · Inspect a terrain transect"),
        (55, 69, "Embarko · Reconstructed deployment prompt"),
        (69, DURATION, "Public prototype"),
    ]
    for start, end, title in chapters:
        events.append(text(start, end, APP_X, LABEL_Y, title, 26, bold=True))
    if preview:
        events.append(text(0, DURATION, APP_X + APP_W, LABEL_Y + 4, "Synthetic preview voice", 22,
                           color="BBDBB9", alignment=9))
        for start, end, lines in cues:
            events.append(box(start, end, CAPTION_BOX, "081B1B"))
            caption = r"\N".join(lines)
            events.append(text(start, end, WIDTH // 2, 871, caption, 44, alignment=5))

    # This layer documents the previous deployment and leaves the public navigation visible.
    for start, end in ((55, 69), (69, DURATION)):
        events.append(box(start, end, (450, 204, 1470, 652), "122E2A"))
        events.append(box(start, end, (450, 204, 1470, 210), "BFE694"))
    events.append(text(55, 69, 502, 246, "EMBARKO · PROMPT RECONSTRUCTION", 22, color="BFE694", bold=True))
    events.append(text(55, 69, 502, 300, "Make the prototype public", 52, bold=True))
    events.append(box(55, 69, (502, 398, 506, 505), "BFE694"))
    events.append(text(55, 69, 526, 400,
                       r"Deploy TerraScope with Embarko and give me\Na public URL I can share.", 38))
    events.append(text(55, 69, 502, 559, "The public link serves the prototype shown here.", 25,
                       color="CCDFCD"))
    events.append(text(69, DURATION, 502, 250, "PUBLIC PROTOTYPE", 22, color="BFE694", bold=True))
    events.append(text(69, DURATION, 502, 312, "Explore TerraScope", 58, bold=True))
    events.append(text(69, DURATION, 502, 428, "terrascope-floods.embarko.app", 49, bold=True))
    events.append(text(69, DURATION, 502, 541, "#DeployWithEmbarko", 35, color="BFE694", bold=True))
    return "".join(events)


def trim_time(raw):
    result = run_ffmpeg(
        "-t", 20, "-i", raw, "-vf", "fps=25,crop=2:2:1534:76",
        "-pix_fmt", "rgb24", "-f", "rawvideo", "-", stdout=subprocess.PIPE,
    )
    pixels = result.stdout
    frames = []
    for i in range(0, len(pixels), 12):
        red, green, blue = pixels[i:i+3]
        if red > 160 and green < 55 and blue > 158:
            frames.append(i // 12)
    if len(frames) < 4 or frames[-1] - frames[0] + 1 != len(frames):
        raise RuntimeError("Capture start marker missing or noncontinuous")
    return (frames[-1] + 2) / 25


def probe(path):
    result = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries",
        "stream=codec_type,width,height,sample_aspect_ratio:format=duration",
        "-of", "json", str(path),
    ])
    return json.loads(result)


def validate(path, preview):
    properties = probe(path)
    streams = properties["streams"]
    expected_streams = ["video", "audio"] if preview else ["video"]
    video = streams[0]
    if [stream["codec_type"] for stream in streams] != expected_streams:
        raise ValueError(f"Unanticipated video or audio stream: {path}")
    if (video["width"], video["height"], video["sample_aspect_ratio"]) != (WIDTH, HEIGHT, "1:1"):
        raise ValueError(f"Wrong video dimensions or pixel aspect: {path}")
    if abs(float(properties["format"]["duration"]) - DURATION) > 0.034:
        raise ValueError(f"Wrong cut duration: {path}")


def caption_ink(path, cues):
    """Measure white caption pixels in the actual encoded preview, including the safe margin."""
    left, top, right, bottom = CAPTION_BOX
    origin_x, origin_y = left - 10, APP_Y + APP_H
    width, height = right - left + 20, bottom - origin_y + 12
    sample_frames = [round((start + end) * 15) for start, end, _ in cues]
    selector = "+".join(rf"eq(n\,{frame})" for frame in sample_frames)
    result = run_ffmpeg(
        "-i", path, "-an", "-vf", f"select={selector},crop={width}:{height}:{origin_x}:{origin_y}",
        "-fps_mode", "passthrough", "-pix_fmt", "gray", "-f", "rawvideo", "-", stdout=subprocess.PIPE,
    )
    image_bytes = width * height
    if len(result.stdout) != len(cues) * image_bytes:
        raise ValueError("Could not sample a frame from every caption")
    extents = []
    for index, frame in enumerate(sample_frames):
        pixels = result.stdout[index * image_bytes:(index + 1) * image_bytes]
        ink = [i for i, lightness in enumerate(pixels) if lightness > 192]
        if not ink:
            raise ValueError(f"Caption {index + 1} missing from encoded video")
        bounds = [origin_x + min(i % width for i in ink), origin_y + ink[0] // width,
                  origin_x + max(i % width for i in ink), origin_y + ink[-1] // width]
        if not (left <= bounds[0] <= bounds[2] < right and top <= bounds[1] <= bounds[3] < bottom):
            raise ValueError(f"Caption ink outside safe band at frame {frame}: {bounds}")
        # Near the left edge of the caption box the center-aligned text leaves only its backing.
        backing = [origin_y + row for row in range(height) if pixels[row * width + 20] <= 27]
        if not backing or min(backing) < top - 1 or max(backing) >= bottom:
            raise ValueError(f"Caption background outside safe band at frame {frame}: {backing}")
        extents.append({"frame": frame, "ink": bounds, "backingRows": [min(backing), max(backing)]})
    return extents


def render(work, audio, raw, cue_list, trim, preview):
    name = "terrascope-demo" if preview else "terrascope-clean"
    subtitle_name = name + ".ass"
    (work / subtitle_name).write_text(overlays(cue_list, preview), encoding="utf-8")
    target = work / (name + ".mp4")
    video = (f"fps=30,setsar=1,pad={WIDTH}:{HEIGHT}:{APP_X}:{APP_Y}:"
             f"color={BACKGROUND},subtitles={subtitle_name}")
    audio_args = ["-i", audio, "-map", "0:v:0", "-map", "1:a:0", "-c:a", "copy",
                  "-metadata:s:a:0", "title=Synthetic preview narration"] if preview else ["-an"]
    run_ffmpeg(
        "-y", "-ss", trim, "-i", raw, *audio_args, "-vf", video, "-t", DURATION,
        "-c:v", "libx264", "-preset", "fast", "-crf", 20, "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", target, cwd=work,
    )
    validate(target, preview)
    return target


def publish(exports, out):
    """Keep both prior exports if a video player blocks either replacement."""
    with TemporaryDirectory(prefix=".demo-exports-", dir=out) as staging:
        stage = Path(staging)
        originals = {}
        for export in exports:
            destination = out / export.name
            shutil.copy2(export, stage / export.name)
            if destination.exists():
                originals[destination] = Path(shutil.copy2(destination, stage / (export.name + ".backup")))
        replaced = []
        try:
            for export in exports:
                destination = out / export.name
                (stage / export.name).replace(destination)
                replaced.append(destination)
        except OSError as error:
            for destination in reversed(replaced):
                if destination not in originals:
                    destination.unlink()
                    continue
                backup = originals[destination]
                try:
                    backup.replace(destination)
                except OSError as restore_error:
                    recovery = out / (destination.stem + ".previous.mp4")
                    shutil.copy2(backup, recovery)
                    raise RuntimeError(f"Could not restore {destination}. Previous export saved to {recovery}.") from restore_error
            raise RuntimeError("Could not replace the MP4s. Close any player or preview server serving them and retry.") from error


def record_composition(work, trim, ink):
    evidence = {
        "source": "https://terrascope-floods.embarko.app",
        "sourceTrimSeconds": trim,
        "frame": [WIDTH, HEIGHT],
        "app": [APP_X, APP_Y, APP_W, APP_H],
        "labelTop": LABEL_Y,
        "captionBand": CAPTION_BOX,
        "captionBottomClearance": HEIGHT - CAPTION_BOX[3],
        "captions": len(ink),
        "captionFrameSamples": ink,
        "durationSeconds": DURATION,
    }
    (work / "composition.json").write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in evidence.items() if k != "captionFrameSamples"}, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--work", type=Path, default=DEFAULT_WORK)
    parser.add_argument("--audio", type=Path, help="Original isolated synthetic preview narration")
    parser.add_argument("--output", type=Path, default=DEMO)
    args = parser.parse_args()
    work, out = args.work.resolve(), args.output.resolve()
    audio = args.audio.resolve() if args.audio else work / "synthetic-preview.m4a"
    raw = work / "public-app.webm"
    cue_list = captions(DEMO / "terrascope-demo.vtt")
    if LABEL_Y < 64 or APP_Y + APP_H > CAPTION_BOX[1] or HEIGHT - CAPTION_BOX[3] < max(120, HEIGHT * .15):
        raise ValueError("Composition does not reserve the required overlay and caption regions")
    video = probe(raw)["streams"][0]
    if (video["width"], video["height"]) != (APP_W, APP_H):
        raise ValueError("Raw capture must match the intended app dimensions")
    if not args.audio:
        run_ffmpeg("-y", "-i", DEMO / "terrascope-demo.mp4", "-vn", "-c:a", "copy", audio)
    trim = trim_time(raw)
    out.mkdir(parents=True, exist_ok=True)
    exports = [render(work, audio, raw, cue_list, trim, preview) for preview in (True, False)]
    ink = caption_ink(exports[0], cue_list)
    publish(exports, out)
    record_composition(work, trim, ink)


if __name__ == "__main__":
    main()
