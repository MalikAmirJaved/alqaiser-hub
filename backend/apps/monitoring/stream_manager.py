import os
import uuid
import signal
import subprocess
import threading
import shutil
import time
from datetime import datetime
from django.conf import settings


class StreamManager:
    _instances: dict = {}
    _lock = threading.Lock()
    _MAX_RESTARTS = 5

    @classmethod
    def _build_ffmpeg_cmd(cls, rtsp_url: str, output_dir: str) -> list[str]:
        hls_file = os.path.join(output_dir, 'index.m3u8')
        return [
            'ffmpeg',
            '-rtsp_transport', 'tcp',
            '-re',
            '-fflags', 'nobuffer',
            '-flags', 'low_delay',
            '-strict', 'unofficial',
            '-analyzeduration', '0',
            '-probesize', '32',
            '-i', rtsp_url,
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-tune', 'zerolatency',
            '-g', '24',
            '-keyint_min', '12',
            '-sc_threshold', '0',
            '-vf', 'scale=-2:720',
            '-c:a', 'aac',
            '-ar', '44100',
            '-ac', '1',
            '-f', 'hls',
            '-hls_time', '2',
            '-hls_list_size', '6',
            '-hls_flags', 'delete_segments+omit_endlist+append_list',
            '-hls_segment_filename', os.path.join(output_dir, 'segment_%d.ts'),
            '-max_muxing_queue_size', '1024',
            '-progress', '-',
            '-y', hls_file,
        ]

    @classmethod
    def start(cls, camera_id: str, rtsp_url: str) -> tuple[str, str]:
        stream_id = str(uuid.uuid4())
        output_dir = os.path.join(settings.MEDIA_ROOT, 'streams', stream_id)
        os.makedirs(output_dir, exist_ok=True)

        cmd = cls._build_ffmpeg_cmd(rtsp_url, output_dir)

        try:
            log_file = os.path.join(output_dir, 'ffmpeg.log')
            with open(log_file, 'w') as f:
                process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.DEVNULL,
                    stderr=f,
                )
        except FileNotFoundError:
            shutil.rmtree(output_dir, ignore_errors=True)
            raise RuntimeError("FFmpeg not found. Install FFmpeg to enable streaming.")

        # Wait until at least one .ts segment file exists (confirms stream is producing data)
        hls_file = os.path.join(output_dir, 'index.m3u8')
        wait_start = time.monotonic()
        while time.monotonic() - wait_start < 10:
            if process.poll() is not None:
                break
            # Check if any segment files exist
            if os.path.exists(hls_file):
                # Verify the m3u8 has at least one segment listed
                try:
                    with open(hls_file, 'r') as f:
                        content = f.read()
                    if '#EXTINF:' in content:
                        break
                except Exception:
                    pass
            time.sleep(0.5)

        poll = process.poll()
        if poll is not None:
            shutil.rmtree(output_dir, ignore_errors=True)
            raise RuntimeError(
                "FFmpeg exited immediately. Check that the RTSP URL is correct "
                "and the camera is reachable."
            )

        # Brief extra time to ensure the first segment completes writing
        time.sleep(0.5)

        with cls._lock:
            cls._instances[stream_id] = {
                'process': process,
                'camera_id': camera_id,
                'output_dir': output_dir,
                'rtsp_url': rtsp_url,
                'created_at': datetime.now(),
                'restart_count': 0,
            }

        # Background watcher to auto-restart on crash
        watcher = threading.Thread(
            target=cls._watch_process,
            args=(stream_id,),
            daemon=True,
            name=f'stream-watcher-{stream_id[:8]}',
        )
        watcher.start()

        hls_path = f'{settings.MEDIA_URL}streams/{stream_id}/index.m3u8'
        return stream_id, hls_path

    @classmethod
    def _watch_process(cls, stream_id: str):
        """Monitor FFmpeg process and auto-restart if it crashes (up to MAX_RESTARTS)."""
        time.sleep(5)  # Let it stabilize first

        while True:
            with cls._lock:
                instance = cls._instances.get(stream_id)
                if instance is None:
                    return  # Stream was stopped

            process = instance['process']
            poll = process.poll()

            if poll is not None:
                # Process died — attempt restart
                with cls._lock:
                    inst = cls._instances.get(stream_id)
                    if inst is None:
                        return
                    inst['restart_count'] += 1
                    rc = inst['restart_count']
                    if rc > cls._MAX_RESTARTS:
                        cls._instances.pop(stream_id, None)
                        shutil.rmtree(instance['output_dir'], ignore_errors=True)
                        return

                # Log the crash
                log_file = os.path.join(instance['output_dir'], 'ffmpeg.log')
                with open(log_file, 'a') as f:
                    f.write(f"\n--- FFmpeg exited (code {poll}), restart #{rc} ---\n")

                # Start fresh in a new directory
                old_dir = instance['output_dir']
                new_stream_id = str(uuid.uuid4())
                new_output_dir = os.path.join(
                    settings.MEDIA_ROOT, 'streams', new_stream_id
                )
                os.makedirs(new_output_dir, exist_ok=True)

                cmd = cls._build_ffmpeg_cmd(instance['rtsp_url'], new_output_dir)
                try:
                    new_log = os.path.join(new_output_dir, 'ffmpeg.log')
                    with open(new_log, 'w') as f:
                        new_process = subprocess.Popen(
                            cmd,
                            stdout=subprocess.DEVNULL,
                            stderr=f,
                        )

                    # Wait for first segment
                    new_hls_file = os.path.join(new_output_dir, 'index.m3u8')
                    wait_start = time.monotonic()
                    while time.monotonic() - wait_start < 10:
                        if new_process.poll() is not None:
                            break
                        if os.path.exists(new_hls_file):
                            try:
                                with open(new_hls_file, 'r') as f:
                                    content = f.read()
                                if '#EXTINF:' in content:
                                    break
                            except Exception:
                                pass
                        time.sleep(0.5)

                    if new_process.poll() is not None:
                        shutil.rmtree(new_output_dir, ignore_errors=True)
                        with cls._lock:
                            cls._instances.pop(stream_id, None)
                        return

                    # Swap in the new process & output dir
                    with cls._lock:
                        inst = cls._instances.get(stream_id)
                        if inst:
                            inst['process'] = new_process
                            inst['output_dir'] = new_output_dir
                            inst['created_at'] = datetime.now()

                    # Clean up old segments in background
                    threading.Thread(
                        target=lambda: shutil.rmtree(old_dir, ignore_errors=True),
                        daemon=True,
                    ).start()

                except Exception:
                    with cls._lock:
                        cls._instances.pop(stream_id, None)
                    shutil.rmtree(new_output_dir, ignore_errors=True)
                    return

            time.sleep(3)

    @classmethod
    def stop(cls, stream_id: str) -> bool:
        with cls._lock:
            instance = cls._instances.pop(stream_id, None)

        if instance is None:
            return False

        process = instance['process']
        process.send_signal(signal.SIGTERM)

        def cleanup():
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
            shutil.rmtree(instance['output_dir'], ignore_errors=True)

        threading.Thread(target=cleanup, daemon=True).start()
        return True

    @classmethod
    def get_active_stream(cls, camera_id: str) -> str | None:
        with cls._lock:
            for sid, inst in cls._instances.items():
                if inst['camera_id'] == camera_id:
                    return sid
        return None

    @classmethod
    def get_status(cls, stream_id: str) -> dict | None:
        with cls._lock:
            instance = cls._instances.get(stream_id)
            if instance is None:
                return None
            process = instance['process']
            poll = process.poll()
            return {
                'stream_id': stream_id,
                'camera_id': instance['camera_id'],
                'running': poll is None,
                'uptime_seconds': (datetime.now() - instance['created_at']).total_seconds(),
                'restart_count': instance['restart_count'],
            }

    @classmethod
    def cleanup_all(cls):
        with cls._lock:
            ids = list(cls._instances.keys())
        for sid in ids:
            cls.stop(sid)

    @classmethod
    def cleanup_stale_dirs(cls, max_age_minutes: int = 30):
        """Remove stream directories older than max_age_minutes (startup cleanup)."""
        streams_dir = os.path.join(settings.MEDIA_ROOT, 'streams')
        if not os.path.isdir(streams_dir):
            return
        now = datetime.now()
        for entry in os.listdir(streams_dir):
            dir_path = os.path.join(streams_dir, entry)
            if not os.path.isdir(dir_path):
                continue
            try:
                mtime = datetime.fromtimestamp(os.path.getmtime(dir_path))
                if (now - mtime).total_seconds() > max_age_minutes * 60:
                    shutil.rmtree(dir_path, ignore_errors=True)
            except Exception:
                pass
