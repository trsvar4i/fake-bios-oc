# Озвучка промо-ролика: каждая фраза script.json -> public/vo/<n>.mp3 + длительности в public/vo/durations.json
# Запуск: python voice.py   (нужен пакет edge-tts: python -m pip install --user edge-tts)
import asyncio, json, pathlib
import edge_tts

VOICE = "ru-RU-DmitryNeural"
RATE = "+12%"
OUT = pathlib.Path(__file__).parent / "public" / "vo"


async def once(i: int, text: str) -> float:
    com = edge_tts.Communicate(text, VOICE, rate=RATE)
    end = 0.0
    audio = bytearray()
    async for chunk in com.stream():
        if chunk["type"] == "audio":
            audio += chunk["data"]
        elif chunk["type"] in ("WordBoundary", "SentenceBoundary"):
            # смещение и длительность — в сотнях наносекунд
            end = max(end, (chunk["offset"] + chunk["duration"]) / 1e7)
    (OUT / f"{i}.mp3").write_bytes(audio)
    return round(end + 0.15, 2)


async def one(i: int, text: str) -> float:
    # сервис иногда отвечает пустотой на запросы подряд — повторяем с паузой
    for attempt in range(8):
        try:
            return await once(i, text)
        except edge_tts.exceptions.NoAudioReceived:
            await asyncio.sleep(2 + attempt * 2)
    raise RuntimeError(f"no audio for line {i}")


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    lines = json.loads((OUT.parent.parent / "script.json").read_text(encoding="utf-8"))
    durations = [await one(i, t) for i, t in enumerate(lines)]
    (OUT / "durations.json").write_text(json.dumps(durations), encoding="utf-8")
    print(durations, "total", round(sum(durations), 2))


asyncio.run(main())
