"""Settings read from environment variables. No secret has a default value."""
import os
from dataclasses import dataclass, field


def _f(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except ValueError:
        return default


@dataclass
class Thresholds:
    stale_timeout_s: float = 15
    startup_delay_s: float = 10
    flow_min_lpm: float = 0.2
    tds_warn_high: float = 500
    temp_min: float = 5
    temp_max: float = 40


# Plausible sensor ranges. Values outside are rejected as out_of_range. Verify against the real sensors.
RANGES = {
    "tds_ppm": (0.0, 1000.0),
    "temperature_c": (-10.0, 85.0),
    "flow_lpm": (0.0, 6.0),
}


@dataclass
class Settings:
    database_path: str = "./filtravyn.db"
    cors_origins: list = field(default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"])
    device_api_key: str = ""
    admin_api_key: str = ""
    pump_control_enabled: bool = False
    pump_min_interval_s: float = 5
    mqtt_url: str = ""
    mqtt_username: str = ""
    mqtt_password: str = ""
    mqtt_topic: str = "filtravyn/+/telemetry"
    thresholds: Thresholds = field(default_factory=Thresholds)


def load_settings() -> Settings:
    e = os.environ
    return Settings(
        database_path=e.get("DATABASE_PATH", "./filtravyn.db"),
        cors_origins=[o.strip() for o in e.get("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()],
        device_api_key=e.get("DEVICE_API_KEY", ""),
        admin_api_key=e.get("ADMIN_API_KEY", ""),
        pump_control_enabled=e.get("PUMP_CONTROL_ENABLED", "0") == "1",
        pump_min_interval_s=_f("PUMP_MIN_COMMAND_INTERVAL_S", 5),
        mqtt_url=e.get("MQTT_URL", ""),
        mqtt_username=e.get("MQTT_USERNAME", ""),
        mqtt_password=e.get("MQTT_PASSWORD", ""),
        mqtt_topic=e.get("MQTT_TOPIC", "filtravyn/+/telemetry"),
        thresholds=Thresholds(
            stale_timeout_s=_f("STALE_TIMEOUT_S", 15),
            startup_delay_s=_f("PUMP_STARTUP_DELAY_S", 10),
            flow_min_lpm=_f("FLOW_MIN_LPM", 0.2),
            tds_warn_high=_f("TDS_WARN_HIGH_PPM", 500),
            temp_min=_f("TEMP_MIN_C", 5),
            temp_max=_f("TEMP_MAX_C", 40),
        ),
    )
