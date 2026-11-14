"""s (m le long de l'axe intérieur) -> lat, lon, cap. Usage: s2ll.py s1 s2 ..."""
import math, os, sys
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = [tuple(map(float, t.split(","))) for t in open(os.path.join(R, "data", "ring_raw.txt")).read().split()]
LAT0, LON0 = 48.8590, 2.3400
def at(s):
    acc = 0.0
    n = len(P)
    for i in range(n):
        a, b = P[i], P[(i + 1) % n]
        d = math.hypot(b[0] - a[0], b[1] - a[1])
        if acc + d >= s:
            t = (s - acc) / d
            x = a[0] + (b[0] - a[0]) * t; z = a[1] + (b[1] - a[1]) * t
            hd = math.degrees(math.atan2(b[0] - a[0], -(b[1] - a[1]))) % 360
            lat = LAT0 - z / 111320.0
            lon = LON0 + x / (111320.0 * math.cos(math.radians(LAT0)))
            return lat, lon, hd
        acc += d
    return None
if __name__ == "__main__":
    tot = sum(math.hypot(P[(i+1)%len(P)][0]-P[i][0], P[(i+1)%len(P)][1]-P[i][1]) for i in range(len(P)))
    print("total", round(tot))
    for a in sys.argv[1:]:
        lat, lon, hd = at(float(a) % tot)
        print(a, "%.6f,%.6f" % (lat, lon), "heading %.0f" % hd)
