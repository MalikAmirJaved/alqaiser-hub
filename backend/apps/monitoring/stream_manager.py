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

    @classmethod
    def start(cls, camera_id: str, rtsp_url: str) -> tuple[str, str]:
        stream_id = str(uuid.uuid4())
        output_dir = os.path.join(settings.MEDIA_ROOT, 'streams', stream_id)
        os.makedirs(output_dir, exist_ok=True)

        hls_file = os.path.join(output_dir, 'index.m3u8')

        cmd = [
            'ffmpeg',
            '-rtsp_transport', 'tcp',
            '-i', rtsp_url,
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-tune', 'zerolatency',
            '-c:a', 'aac',
            '-ar', '44100',
            '-ac', '1',
            '-f', 'hls',
            '-hls_time', '2',
            '-hls_list_size', '3',
            '-hls_flags', 'delete_segments+omit_endlist',
            '-progress', '-',
            '-y', hls_file,
        ]

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

        time.sleep(1)

        poll = process.poll()
        if poll is not None:
            shutil.rmtree(output_dir, ignore_errors=True)
            raise RuntimeError(
                "FFmpeg exited immediately. Check that the RTSP URL is correct "
                "and the camera is reachable."
            )

        with cls._lock:
            cls._instances[stream_id] = {
                'process': process,
                'camera_id': camera_id,
                'output_dir': output_dir,
                'created_at': datetime.now(),
            }

        hls_path = f'{settings.MEDIA_URL}streams/{stream_id}/index.m3u8'
        return stream_id, hls_path

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
    def cleanup_all(cls):
        with cls._lock:
            ids = list(cls._instances.keys())
        for sid in ids:
            cls.stop(sid)
