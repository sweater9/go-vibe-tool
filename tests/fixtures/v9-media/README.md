# Synthetic video fixtures

These 2.2-second 160×100, 15 fps clips contain FFmpeg's `testsrc2` pattern and a 440 Hz sine wave at 48 kHz. They contain no user data. Bundling them avoids depending on the browser's recording support merely to create the test input: WebKit must still exercise video-to-GIF even when `video.captureStream` is absent.

Generated using:

```sh
ffmpeg -f lavfi -i testsrc2=size=160x100:rate=15:duration=2.2 -f lavfi -i sine=frequency=440:sample_rate=48000:duration=2.2 -c:v libvpx -b:v 120k -c:a libopus -shortest video-tone.webm
ffmpeg -f lavfi -i testsrc2=size=160x100:rate=15:duration=2.2 -f lavfi -i sine=frequency=440:sample_rate=48000:duration=2.2 -c:v libx264 -pix_fmt yuv420p -c:a aac -movflags +faststart -shortest video-tone.mp4
```

The tests choose WebM (VP8/Opus) when the browser advertises support, otherwise MP4 (H.264/AAC). Lack of both decoders is a test failure. Lack of a capture API/WebM encoder is reported separately as `capability-limited` after verifying the visible error and GIF alternative; it is never reported as a successful WebM export. Exported WebM is decoded and checked for audible samples and expected duration. Video-to-GIF must export five frames totaling 500 ms on each engine.
