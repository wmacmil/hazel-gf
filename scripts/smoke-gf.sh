#!/bin/sh
set -eu

app_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
term='MkS Present Positive (PredVP (UsePron IPron) (ComplV2 SeeV2 (DetCN Definite (UseN WomanN))))'
output=$(printf 'l -treebank (%s)\nq\n' "$term" | gf --run "$app_dir/public/HazelGF.pgf")

printf '%s\n' "$output" | grep -Fqx 'HazelGFEng: I see the woman'
printf '%s\n' "$output" | grep -Fqx 'HazelGFGer: ich sehe die Frau'
printf '%s\n' "$output" | grep -Fqx 'HazelGFSwe: jag ser kvinnan'

past='MkS PastPerfect Negative (PredVP (DetCN Definite (UseN ManN)) (UseV SleepV))'
past_output=$(printf 'l -treebank (%s)\nq\n' "$past" | gf --run "$app_dir/public/HazelGF.pgf")
printf '%s\n' "$past_output" | grep -Fqx "HazelGFEng: the man hadn't slept"
printf '%s\n' "$past_output" | grep -Fqx 'HazelGFGer: der Mann hatte nicht geschlafen'
printf '%s\n' "$past_output" | grep -Fqx 'HazelGFSwe: mannen hade inte sovit'
printf '%s\n' "$output" "$past_output"
