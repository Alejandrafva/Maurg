"""Instrumental fashion lenta (75 BPM) para 'Welcome to MAURG.' — sintetizada, libre de derechos.
Uso: python3 musica_welcome.py salida.wav
"""
import sys
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 44100
DUR = 20.0
BPM = 75
BEAT = 60 / BPM          # 0.8 s
BAR = BEAT * 4           # 3.2 s
N = int(SR * DUR)
rng = np.random.default_rng(7)
t_all = np.arange(N) / SR


def hz(m):
    return 440 * 2 ** ((m - 69) / 12)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, 'low', fs=SR, output='sos'), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, 'high', fs=SR, output='sos'), x)


def add(buf, sig, start):
    i = int(start * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i]


def env_adsr(n, a, d, s, r):
    t = np.arange(n) / SR
    L = n / SR
    e = np.where(t < a, t / a, s + (1 - s) * np.exp(-(t - a) / d))
    e *= np.clip((L - t) / r, 0, 1)
    return e


def epiano(m, dur, vel=1.0):
    """Piano eléctrico FM suave."""
    n = int((dur + 1.5) * SR)
    t = np.arange(n) / SR
    f = hz(m)
    menv = np.exp(-t * 3.5)
    mod = 1.6 * menv * np.sin(2 * np.pi * f * 1.0 * t)
    car = np.sin(2 * np.pi * f * t + mod) + .25 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t * 6)
    e = env_adsr(n, .006, 1.4, .25, 1.4) * np.clip((dur + 1.5 - t) / 1.4, 0, 1)
    trem = 1 + .12 * np.sin(2 * np.pi * 4.2 * t)
    return car * e * trem * vel


def pad(m, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = hz(m)
    x = sum(np.sign(np.sin(2 * np.pi * f * (1 + d) * t + rng.uniform(0, 6))) * .5 + np.sin(2 * np.pi * f * (1 + d) * t)
            for d in (-.004, 0, .005))
    x = lp(x, 1400, 2)
    a = min(1.2, dur / 3)
    e = np.clip(t / a, 0, 1) * np.clip((dur - t) / 1.0, 0, 1)
    return x * e / 3


def kick(vel=1.0):
    n = int(.6 * SR)
    t = np.arange(n) / SR
    f = 45 + 90 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 6.5) * vel


def snap(vel=1.0):
    n = int(.35 * SR)
    t = np.arange(n) / SR
    nz = hp(rng.standard_normal(n), 1500) * np.exp(-t * 28)
    body = np.sin(2 * np.pi * 210 * t) * np.exp(-t * 40) * .4
    return (nz * .55 + body) * vel


def hat(vel=1.0, open_=False):
    n = int((.3 if open_ else .08) * SR)
    t = np.arange(n) / SR
    nz = hp(rng.standard_normal(n), 7000, 4)
    return nz * np.exp(-t * (12 if open_ else 60)) * vel


def bass(m, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = hz(m)
    x = np.sin(2 * np.pi * f * t) + .15 * np.sin(2 * np.pi * 2 * f * t)
    e = np.clip(t / .01, 0, 1) * np.exp(-t * 1.2) * np.clip((dur - t) / .08, 0, 1)
    return x * e


def reverb(x, secs=2.8, wet=.3):
    n = int(secs * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal((2, n)) * np.exp(-t * 3 / secs * 2.3)
    ir[:, : int(.02 * SR)] *= np.linspace(0, 1, int(.02 * SR))
    ir = np.stack([lp(ir[0], 6000), lp(ir[1], 6000)])
    out = np.stack([fftconvolve(x[0], ir[0])[: len(x[0])], fftconvolve(x[1], ir[1])[: len(x[1])]])
    out /= np.max(np.abs(out)) + 1e-9
    return x * (1 - wet) + out * wet * np.max(np.abs(x))


# Progresión: Am9 | Fmaj9 | Cmaj7 | G6 | Am9 | Fmaj9 | Am9 (final)
chords = [
    (45, [57, 60, 64, 67, 71]),   # Am9
    (41, [57, 60, 64, 67, 69]),   # Fmaj9 (voz: A C E G + A)
    (48, [55, 59, 64, 67, 72]),   # Cmaj7
    (43, [55, 59, 62, 64, 67]),   # G6
    (45, [57, 60, 64, 67, 71]),
    (41, [57, 60, 64, 65, 69]),
    (45, [57, 60, 64, 67, 71, 76]),
]

keys = np.zeros(N); pads = np.zeros(N); bas = np.zeros(N); drums = np.zeros((2, N))
for i, (root, notes) in enumerate(chords):
    t0 = i * BAR
    last = i == len(chords) - 1
    dur = (DUR - t0) if last else BAR
    add(pads, sum(pad(m, dur + .6) for m in notes[:4]), t0)
    # acorde arpegiado suave al inicio de cada compás + golpe en el "y" del 3
    for k, m in enumerate(notes):
        add(keys, epiano(m, BEAT * 2.2, .55 - k * .04), t0 + k * .035)
    if not last:
        for k, m in enumerate(notes[1:4]):
            add(keys, epiano(m, BEAT * .9, .3), t0 + BEAT * 2.5 + k * .03)
    # bajo desde 2.4 s
    if t0 >= BAR - .01 or i == 0:
        if t0 + 0 >= 2.39 or i > 0:
            add(bas, bass(root, BEAT * 1.4), t0)
            add(bas, bass(root, BEAT * .9), t0 + BEAT * 1.5)
            add(bas, bass(root + 7, BEAT * .9), t0 + BEAT * 3)

# Batería: entra en 2.4 s, se va en 15.2 s (logo) y vuelve suave para cerrar
for b in range(int(DUR / BEAT * 2)):
    t = b * BEAT / 2
    if t < 2.39 or 15.19 <= t < 16.0 or t > 18.8:
        continue
    soft = .6 if t >= 16 else 1.0
    beat = b / 2
    if b % 2 == 0 and int(beat) % 4 in (0, 2):
        add(drums[0], kick(.9 * soft), t); add(drums[1], kick(.9 * soft), t)
    if b % 2 == 0 and int(beat) % 4 in (1, 3) and t >= 4.79:
        s = snap(.45 * soft); add(drums[0], s * .9, t); add(drums[1], s, t)
    if t >= 4.79:
        swing = .045 if b % 2 else 0
        h = hat((.16 if b % 2 else .1) * soft, open_=(b % 8 == 7))
        pan = .7 if b % 2 else 1.0
        add(drums[0], h * pan, t + swing); add(drums[1], h * (1.7 - pan), t + swing)

# Barrido (whoosh) antes del logo y golpe suave en 15.2 s
n = int(1.6 * SR); tt = np.arange(n) / SR
sweep = hp(rng.standard_normal(n), 300) * (tt / 1.6) ** 2.5 * .25
cut = np.zeros(N); add(cut, sweep, 15.2 - 1.6)
imp = np.zeros(N); add(imp, kick(1.0) * .8 + lp(rng.standard_normal(int(.6 * SR)), 900) * np.exp(-np.arange(int(.6 * SR)) / SR * 5) * .3, 15.2)

keys = lp(keys, 5000)
st = lambda x, l=1.0, r=1.0: np.stack([x * l, x * r])
mix = st(keys, .95, 1.05) * .42 + st(pads, 1.05, .95) * .22 + st(bas) * .5 + st(cut, .9, 1.1) + st(imp) * .7
mix = reverb(mix, 3.0, .32)
mix += drums * .55

# Ducking para la voz en off (tramos donde habla)
voice = [(1.2, 4.4), (5.0, 7.9), (8.6, 10.1), (11.0, 13.3), (14.0, 17.9)]
g = np.ones(N)
for a, b in voice:
    g[int(a * SR):int(b * SR)] = .55
g = lp(g, 3, 1)
mix *= g

# Fade in/out y master
fade = np.clip(t_all / .4, 0, 1) * np.clip((DUR - t_all) / 2.2, 0, 1)
mix *= fade
mix = np.tanh(mix * 1.3) / np.tanh(1.3)
mix /= np.max(np.abs(mix)) / .89

from scipy.io import wavfile
wavfile.write(sys.argv[1], SR, (mix.T * 32767).astype(np.int16))
print('ok', sys.argv[1])
