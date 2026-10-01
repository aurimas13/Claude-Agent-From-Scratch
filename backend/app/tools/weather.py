"""Current weather + short forecast from Open-Meteo (free, no API key, CC BY 4.0)."""

from __future__ import annotations

import json

import httpx

from .geocoding import geocode

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

# WMO weather interpretation codes -> (description, emoji-free icon name used by the UI)
WEATHER_CODES: dict[int, tuple[str, str]] = {
    0: ("Clear sky", "sun"),
    1: ("Mainly clear", "sun"),
    2: ("Partly cloudy", "cloud-sun"),
    3: ("Overcast", "cloud"),
    45: ("Fog", "fog"),
    48: ("Rime fog", "fog"),
    51: ("Light drizzle", "drizzle"),
    53: ("Drizzle", "drizzle"),
    55: ("Dense drizzle", "drizzle"),
    56: ("Freezing drizzle", "drizzle"),
    57: ("Freezing drizzle", "drizzle"),
    61: ("Light rain", "rain"),
    63: ("Rain", "rain"),
    65: ("Heavy rain", "rain"),
    66: ("Freezing rain", "rain"),
    67: ("Freezing rain", "rain"),
    71: ("Light snow", "snow"),
    73: ("Snow", "snow"),
    75: ("Heavy snow", "snow"),
    77: ("Snow grains", "snow"),
    80: ("Light showers", "rain"),
    81: ("Showers", "rain"),
    82: ("Violent showers", "rain"),
    85: ("Snow showers", "snow"),
    86: ("Heavy snow showers", "snow"),
    95: ("Thunderstorm", "storm"),
    96: ("Thunderstorm with hail", "storm"),
    99: ("Thunderstorm with heavy hail", "storm"),
}


def describe(code: int | None) -> tuple[str, str]:
    return WEATHER_CODES.get(int(code) if code is not None else -1, ("Unknown", "cloud"))


async def get_weather(location: str, http: httpx.AsyncClient, days: int = 3) -> str:
    """Return a JSON string with current conditions and a daily forecast for `location`."""
    days = max(1, min(int(days), 7))
    place = await geocode(location, http)
    response = await http.get(
        FORECAST_URL,
        params={
            "latitude": place.latitude,
            "longitude": place.longitude,
            "current": "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day",
            "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
            "timezone": "auto",
            "forecast_days": days,
        },
    )
    response.raise_for_status()
    data = response.json()
    current = data.get("current", {})
    daily = data.get("daily", {})
    condition, icon = describe(current.get("weather_code"))

    forecast = []
    for i, date in enumerate(daily.get("time", [])):
        day_condition, day_icon = describe(daily["weather_code"][i])
        forecast.append(
            {
                "date": date,
                "condition": day_condition,
                "icon": day_icon,
                "max_c": daily["temperature_2m_max"][i],
                "min_c": daily["temperature_2m_min"][i],
                "rain_chance_pct": (daily.get("precipitation_probability_max") or [None] * 99)[i],
            }
        )

    return json.dumps(
        {
            "location": place.label,
            "timezone": place.timezone,
            "observed_at_local": current.get("time"),
            "current": {
                "condition": condition,
                "icon": icon,
                "is_day": bool(current.get("is_day", 1)),
                "temperature_c": current.get("temperature_2m"),
                "feels_like_c": current.get("apparent_temperature"),
                "humidity_pct": current.get("relative_humidity_2m"),
                "wind_kmh": current.get("wind_speed_10m"),
            },
            "forecast": forecast,
            "source": "Open-Meteo.com",
        }
    )
