#!/bin/sh
set -eu

app_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
term='MkS Positive (PredVP (UsePron IPron) (ComplV2 SeeV2 (DetCN Definite (UseN WomanN))))'
output=$(printf 'l -treebank (%s)\nq\n' "$term" | gf --run "$app_dir/public/HazelGF.pgf")

printf '%s\n' "$output" | grep -Fqx 'HazelGFEng: I see the woman'
printf '%s\n' "$output" | grep -Fqx 'HazelGFGer: ich sehe die Frau'
printf '%s\n' "$output" | grep -Fqx 'HazelGFSwe: jag ser kvinnan'
printf '%s\n' "$output"
