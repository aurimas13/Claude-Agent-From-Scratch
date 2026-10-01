"""Current local time anywhere: accepts a city ('Tokyo') or an IANA zone ('Asia/Tokyo')."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError, available_timezones

import httpx

from .geocoding import geocode

_ALIASES = {"utc": "UTC", "gmt": "UTC", "z": "UTC"}


async def get_world_time(location: str, http: httpx.AsyncClient) -> str:
    """Return a JSON string describing the current local time in `location`."""
    location = location.strip()
    tz_name = _ALIASES.get(location.lower())
    label = location
    if tz_name is None and location in available_timezones():
        tz_name = location
    if tz_name is None:
        place = await geocode(location, http)
        tz_name, label = place.timezone, place.label

    try:
        tz = ZoneInfo(tz_name)
    except ZoneInfoNotFoundError as exc:
        raise LookupError(f"unknown time zone '{tz_name}'") from exc

    now_utc = datetime.now(UTC)
    local = now_utc.astimezone(tz)
    offset = local.utcoffset()
    offset_hours = offset.total_seconds() / 3600 if offset else 0.0
    return json.dumps(
        {
            "location": label,
            "timezone": tz_name,
            "local_time": local.strftime("%H:%M"),
            "local_date": local.strftime("%A, %d %B %Y"),
            "iso": local.isoformat(timespec="seconds"),
            "utc_offset": local.strftime("%z")[:3] + ":" + local.strftime("%z")[3:],
            "utc_offset_hours": offset_hours,
            "abbreviation": local.tzname(),
            "utc_time": now_utc.strftime("%H:%M"),
        }
    )
