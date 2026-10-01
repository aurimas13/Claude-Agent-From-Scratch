"""City name -> coordinates + time zone, using the free Open-Meteo geocoding API (no key)."""

from __future__ import annotations

from dataclasses import dataclass

import httpx

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
MAX_LOCATION_CHARS = 100

_cache: dict[str, Place] = {}


class PlaceNotFound(LookupError):
    pass


@dataclass(frozen=True)
class Place:
    name: str
    country: str
    admin1: str | None
    latitude: float
    longitude: float
    timezone: str

    @property
    def label(self) -> str:
        parts = [self.name, self.admin1 if self.admin1 != self.name else None, self.country]
        return ", ".join(p for p in parts if p)


def _matches(result: dict, hint: str) -> bool:
    hint = hint.lower()
    return any(
        hint in str(result.get(field) or "").lower() for field in ("country", "country_code", "admin1", "admin2")
    )


async def geocode(location: str, http: httpx.AsyncClient) -> Place:
    """Resolve 'Paris' or 'Paris, France' or 'Springfield, Illinois' to a Place."""
    location = " ".join(location.split())[:MAX_LOCATION_CHARS]
    if not location:
        raise PlaceNotFound("empty location")
    key = location.lower()
    if key in _cache:
        return _cache[key]

    name, _, hint = (part.strip() for part in location.partition(","))
    response = await http.get(GEOCODING_URL, params={"name": name, "count": 10, "language": "en", "format": "json"})
    response.raise_for_status()
    results = response.json().get("results") or []
    if hint:
        results = [r for r in results if _matches(r, hint)] or results
    if not results:
        raise PlaceNotFound(f"could not find a place called '{location}'")

    best = results[0]
    place = Place(
        name=best["name"],
        country=best.get("country") or best.get("country_code", ""),
        admin1=best.get("admin1"),
        latitude=best["latitude"],
        longitude=best["longitude"],
        timezone=best.get("timezone") or "UTC",
    )
    if len(_cache) > 1000:
        _cache.clear()
    _cache[key] = place
    return place
