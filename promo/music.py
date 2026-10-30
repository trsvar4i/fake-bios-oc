# Фоновая музыка ролика, синтезированная с нуля (без сэмплов и чужих треков): public/music.wav
# Тёмный синт-пэд Am–F–C–G, мягкая бочка, хай-хэт и удар на старте. 116 BPM, 30 секунд.
import math, random, struct, wave, pathlib

SR = 44100
LEN = 30.0
BPM = 116
BEAT = 60 / BPM
N = int(SR * LEN)
out = [0.0] * N
random.seed(7)

def add(i, v):
    if 0 <= i < N:
        out[i] += v

def note(f):
    return 440 * 2 ** ((f - 69) / 12)

# аккорды по 2 такта (8 долей): Am, F, C, G
CHORDS = [[57, 60, 64, 69], [53, 57, 60, 65], [48, 55, 60, 64], [55, 59, 62, 67]]
bar2 = BEAT * 8
for k in range(int(LEN / bar2) + 1):
    t0 = k * bar2
    chord = CHORDS[k % 4]
    for m in chord:
        f = note(m)
        for det in (-0.12, 0.12):  # два слегка расстроенных голоса — «ширина»
            ff = f * 2 ** (det / 12)
            start, end = int(t0 * SR), int(min(LEN, t0 + bar2) * SR)
            for i in range(start, end):
                t = (i - start) / SR
                env = min(1, t / 0.6) * min(1, (bar2 - t) / 0.4)
                saw = 2 * ((ff * t) % 1) - 1
                add(i, 0.018 * env * (0.6 * math.sin(2 * math.pi * ff * t) + 0.4 * saw * 0.35))
    # бас — корень аккорда октавой ниже, пульс восьмыми
    root = note(chord[0] - 12)
    for e in range(16):
        start = int((t0 + e * BEAT / 2) * SR)
        for j in range(int(0.22 * SR)):
            t = j / SR
            add(start + j, 0.09 * math.exp(-t * 9) * math.sin(2 * math.pi * root * t))

# бочка на каждую долю после вступления, хай-хэт на слабые доли
beats = int(LEN / BEAT)
for b in range(beats):
    t0 = b * BEAT
    if t0 < 1.0 or t0 > LEN - 1.5:
        continue
    start = int(t0 * SR)
    for j in range(int(0.3 * SR)):
        t = j / SR
        f = 50 + 90 * math.exp(-t * 30)
        add(start + j, 0.38 * math.exp(-t * 11) * math.sin(2 * math.pi * f * t))
    hs = int((t0 + BEAT / 2) * SR)
    for j in range(int(0.05 * SR)):
        add(hs + j, 0.035 * math.exp(-j / SR * 90) * (random.random() * 2 - 1))

# удар на старте и нарастающий шум к финалу
for j in range(int(1.6 * SR)):
    t = j / SR
    add(j, 0.55 * math.exp(-t * 3.2) * math.sin(2 * math.pi * (38 + 60 * math.exp(-t * 8)) * t))
for j in range(int(1.2 * SR)):
    t = j / SR
    add(int((LEN - 4.2) * SR) + j, 0.05 * (t / 1.2) ** 2 * (random.random() * 2 - 1))

# мягкое затухание в конце и нормализация
fade = int(1.2 * SR)
for i in range(fade):
    out[N - fade + i] *= 1 - i / fade
peak = max(abs(x) for x in out) or 1
scale = 0.85 / peak
path = pathlib.Path(__file__).parent / "public" / "music.wav"
with wave.open(str(path), "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, x * scale)) * 32767)) for x in out))
print("ok", path)
