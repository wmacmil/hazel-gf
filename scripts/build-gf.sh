#!/bin/sh
set -eu

app_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
default_rgl_dist="$HOME/code/gf/gf-rgl/dist/alltenses"
rgl_dist=${GF_RGL_DIST:-$default_rgl_dist}

if [ ! -f "$rgl_dist/SyntaxEng.gfo" ]; then
  echo "RGL binaries not found at $rgl_dist" >&2
  echo "Set GF_RGL_DIST to the RGL dist/alltenses directory." >&2
  exit 1
fi

mkdir -p "$app_dir/build/gfo" "$app_dir/public"

# --output-format=json writes both HazelGF.pgf (GF server) and HazelGF.json
# (browser runtime, vendor/gf-typescript).
gf --make --jobs=1 --output-format=json \
  --path="$app_dir/grammar:$rgl_dist" \
  --gfo-dir="$app_dir/build/gfo" \
  --output-dir="$app_dir/public" \
  "$app_dir/grammar/HazelGFEng.gf" \
  "$app_dir/grammar/HazelGFGer.gf" \
  "$app_dir/grammar/HazelGFSwe.gf"
