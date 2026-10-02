#!/usr/bin/env python3
"""Llena `repaso_de` de los jefes de una materia (entrelazado, docs/03: 25–35 % de repaso).

Uso: python scripts/fill-boss-review.py programacion [--dry-run]

Para el jefe de la unidad N elige, de forma reproducible, ejercicios de las unidades 1..N-1:
sin autoevaluación ni retirados, de dificultad 2 a 4, a lo más uno de código largo
(`codigo`, `depurar`, `rastreo_memoria`) y repartidos entre la unidad anterior y las más viejas.
Solo reescribe la línea `repaso_de:`; el resto del archivo queda igual.
"""
from __future__ import annotations

import random
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
LONG = {"codigo", "depurar", "rastreo_memoria"}


def repaso_count(propias: int) -> int:
    # r / (propias + r) lo más cerca posible de 0.30, dentro de [0.25, 0.35].
    best = min(range(0, propias + 1), key=lambda r: abs(r / (propias + r) - 0.30) if propias + r else 1)
    return best


def main(argv: list[str]) -> int:
    materia = argv[1]
    dry = "--dry-run" in argv
    base = ROOT / "content" / materia
    units = sorted(p for p in base.iterdir() if p.is_dir() and re.match(r"^\d{2}-", p.name))
    pool_by_unit: list[list[dict]] = []
    for u in units:
        data = yaml.safe_load((u / "ejercicios.yaml").read_text(encoding="utf-8"))
        pool_by_unit.append([e for e in data["ejercicios"] if not e.get("retirado") and e["tipo"] != "autoevaluacion"])
    for i, u in enumerate(units):
        jf = u / "jefe.yaml"
        text = jf.read_text(encoding="utf-8")
        jefe = yaml.safe_load(text)
        if i == 0:
            chosen: list[str] = []
        else:
            rng = random.Random(f"{materia}/{u.name}")
            n = repaso_count(len(jefe["preguntas"]["propias"]))
            prev = pool_by_unit[i - 1]
            older = [e for pool in pool_by_unit[: i - 1] for e in pool]
            cand = lambda pool: [e for e in pool if 2 <= e["dificultad"] <= 4]
            picks: list[dict] = []
            # La mitad (redondeada hacia arriba) de la unidad anterior; el resto de las más viejas.
            for pool, k in ((cand(prev), (n + 1) // 2), (cand(older) or cand(prev), n - (n + 1) // 2)):
                pool = [e for e in pool if e not in picks]
                rng.shuffle(pool)
                for e in pool:
                    if len([p for p in picks if p in pool]) >= k:
                        break
                    if e["tipo"] in LONG and any(p["tipo"] in LONG for p in picks):
                        continue
                    picks.append(e)
            chosen = [e["id"] for e in picks[:n]]
        line = f"  repaso_de: [{', '.join(chosen)}]"
        new = re.sub(r"^  repaso_de:.*$", line, text, count=1, flags=re.M)
        if new == text and "repaso_de" not in text:
            new = text.replace("  propias:", "  repaso_de: []\n  propias:", 1)
            new = re.sub(r"^  repaso_de:.*$", line, new, count=1, flags=re.M)
        print(f"{u.name}: {len(jefe['preguntas']['propias'])} propias + {len(chosen)} de repaso → {chosen}")
        if not dry:
            jf.write_text(new, encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
