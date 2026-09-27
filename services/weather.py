"""Real weather for weather questions, as a search result the model can cite.

    lookup("whats the weather in johor malaysia tdy?") ->
        {"title": "Weather in Johor Bahru, Johor, Malaysia", "url": ..., "text": "Now: 31 °C …"}

Web search alone can't answer these: weather sites fill in their numbers with
JavaScript, so the page text a search reads is all "Now --". Open-Meteo is a
free, key-less weather service; this finds the place in the question, looks
it up, and returns current conditions plus a short forecast as plain text.
Used only when the user has switched Search on, like the rest of search.
"""

import json
import re
import time
import urllib.parse

from . import web

GEOCODE = "https://geocoding-api.open-meteo.com/v1/search?count=10&language=en&format=json&name={q}"
FORECAST = ("https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&timezone=auto&forecast_days=4"
            "&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m"
            "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum")

STRONG = re.compile(r"\b(weather|forecast)\b", re.I)
ASKS = re.compile(r"\b(weather|forecast|temperature|temp|rain\w*|sunny|cloudy|humid\w*|hot|cold|windy|storm\w*|"
                  r"thunder\w*|snow\w*|degrees|umbrella|haze|hazy)\b", re.I)
# Words that are never part of a place name in a weather question.
FILLER = set("""
a an the is it its it's whats what's what how hows how's will would should could can do does did be being been
going gonna to of for in at on near around like looks look outside there here i me my we you your need bring
today tdy tonight tomorrow tmr tmrw tomoro now right currently current rn later soon this next week weekend
morning afternoon evening night days day hours hour monday tuesday wednesday thursday friday saturday sunday
please pls tell show give get check whether if and or with any some much many more than
weather forecast temperature temp rain raining rainy rains sunny cloudy humid humidity hot cold windy wind storm
storms stormy thunder thunderstorm thunderstorms snow snowing degrees celsius fahrenheit umbrella haze hazy
""".split())
ALIASES = {"kl": "Kuala Lumpur", "jb": "Johor Bahru", "pj": "Petaling Jaya", "kk": "Kota Kinabalu",
           "sg": "Singapore", "hk": "Hong Kong", "nyc": "New York", "ny": "New York", "la": "Los Angeles",
           "sf": "San Francisco", "dc": "Washington"}
CODES = {0: "clear sky", 1: "mainly clear", 2: "partly cloudy", 3: "overcast", 45: "fog", 48: "freezing fog",
         51: "light drizzle", 53: "drizzle", 55: "heavy drizzle", 56: "freezing drizzle", 57: "freezing drizzle",
         61: "light rain", 63: "rain", 65: "heavy rain", 66: "freezing rain", 67: "freezing rain",
         71: "light snow", 73: "snow", 75: "heavy snow", 77: "snow grains", 80: "light showers",
         81: "showers", 82: "violent showers", 85: "snow showers", 86: "heavy snow showers",
         95: "thunderstorms", 96: "thunderstorms with hail", 99: "thunderstorms with heavy hail"}


def place_in(question):
    """The place a weather question is about, or None if it isn't one.
    Prefers the words after the last "in / at / for / near" that still has
    something left once time words are dropped. "Weather" or "forecast"
    alone is enough to count; softer words ("hot", "rain", "temperature")
    need an explicit place — "the temperature of the sun" is not weather."""
    q = question.lower()
    strong = STRONG.search(q)
    if not ASKS.search(q) or not (strong or re.search(r"\b(?:in|at|near|around)\s+[a-z]", q)):
        return None
    words = lambda s: [w for w in re.findall(r"[a-zà-ÿ][a-zà-ÿ'.-]*", s) if w.strip(".'-") not in FILLER]
    parts = re.split(r"\b(?:in|at|for|near|around)\b", q)
    for tail in reversed(parts[1:]):
        found = words(re.split(r"[?!,;]", tail)[0])
        if found:
            return " ".join(found)
    found = words(q) if strong else []
    return " ".join(found) or None


def _geocode(place):
    """Try the whole name, then shorter ones; words left over ("malaysia")
    pick between same-named places."""
    words = place.split()
    for cut in range(len(words), 0, -1):
        name, rest = " ".join(words[:cut]), words[cut:]
        name = ALIASES.get(name, name)
        text, _ = web._get(GEOCODE.format(q=urllib.parse.quote(name)), 200_000)
        hits = json.loads(text).get("results") or []
        if rest:
            hits = [h for h in hits if all(w in f"{h.get('country', '')} {h.get('admin1', '')}".lower() for w in rest)]
        if hits:
            return hits[0]
    return None


def _temp(c):
    return f"{c:.0f} °C ({c * 9 / 5 + 32:.0f} °F)"


def lookup(question):
    """A search result with real weather, or None (not a weather question,
    place not found, or the service unreachable)."""
    place = place_in(question)
    if not place:
        return None
    try:
        where = _geocode(place)
        if not where:
            return None
        text, _ = web._get(FORECAST.format(lat=where["latitude"], lon=where["longitude"]), 200_000)
        f = json.loads(text)
    except Exception:
        return None
    name = ", ".join(x for x in (where.get("name"), where.get("admin1"), where.get("country")) if x)
    now, day = f.get("current", {}), f.get("daily", {})
    lines = [f"Weather in {name} (local time {now.get('time', '').replace('T', ' ')}, source: Open-Meteo)",
             f"Now: {_temp(now['temperature_2m'])}, feels like {_temp(now['apparent_temperature'])}, "
             f"{CODES.get(now.get('weather_code'), 'mixed conditions')}, humidity {now.get('relative_humidity_2m')}%, "
             f"wind {now.get('wind_speed_10m', 0):.0f} km/h, rain in the last hour {now.get('precipitation', 0)} mm",
             "Forecast:"]
    for i, date in enumerate(day.get("time", [])):
        label = "Today" if i == 0 else "Tomorrow" if i == 1 else time.strftime("%A", time.strptime(date, "%Y-%m-%d"))
        lines.append(f"- {label} ({date}): {CODES.get(day['weather_code'][i], 'mixed conditions')}, "
                     f"{_temp(day['temperature_2m_min'][i])} to {_temp(day['temperature_2m_max'][i])}, "
                     f"chance of rain {day['precipitation_probability_max'][i]}%, rain {day['precipitation_sum'][i]} mm")
    return {"title": f"Weather in {name}", "url": "https://open-meteo.com/",
            "domain": "open-meteo.com", "snippet": lines[1], "text": "\n".join(lines)}
