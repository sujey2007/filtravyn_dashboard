"""Optional MQTT -> storage bridge. Runs only when MQTT_URL is set.

Topic shape: filtravyn/<device_id>/telemetry, JSON payload using the telemetry schema in docs/telemetry-schema.md.
The bridge validates every message with the same rules as the HTTP endpoint.
"""
from __future__ import annotations

import json
import logging
from typing import Callable
from urllib.parse import urlparse

from ..config import Settings
from .validation import ValidationError, sanitize

log = logging.getLogger("filtravyn.mqtt")


def start_bridge(settings: Settings, on_record: Callable[[dict], None]):
    """Returns the paho client (already looping in a background thread), or None if disabled or unavailable."""
    if not settings.mqtt_url:
        return None
    try:
        import paho.mqtt.client as mqtt  # imported lazily so the dependency is optional
    except ImportError:
        log.warning("MQTT_URL is set but paho-mqtt is not installed. Run: pip install paho-mqtt")
        return None

    u = urlparse(settings.mqtt_url)
    host, port = u.hostname or "localhost", u.port or (8883 if u.scheme in ("mqtts", "ssl") else 1883)
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    if settings.mqtt_username:
        client.username_pw_set(settings.mqtt_username, settings.mqtt_password or None)
    if u.scheme in ("mqtts", "ssl"):
        client.tls_set()

    def on_connect(c, _userdata, _flags, reason_code, _props=None):
        if getattr(reason_code, "is_failure", False):
            log.error("MQTT connect failed: %s", reason_code)
            return
        c.subscribe(settings.mqtt_topic)
        log.info("MQTT connected, subscribed to %s", settings.mqtt_topic)

    def on_message(_c, _userdata, msg):
        try:
            payload = json.loads(msg.payload.decode("utf-8"))
            parts = msg.topic.split("/")
            if isinstance(payload, dict) and "device_id" not in payload and len(parts) >= 2:
                payload["device_id"] = parts[1]
            on_record(sanitize(payload))
        except (ValueError, ValidationError) as e:
            log.warning("Rejected MQTT message on %s: %s", msg.topic, e)

    client.on_connect = on_connect
    client.on_message = on_message
    client.connect_async(host, port, keepalive=30)
    client.loop_start()
    return client
