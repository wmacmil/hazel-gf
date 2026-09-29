#!/bin/sh
# Publish dist/ as the gh-pages branch (GitHub Pages source).
set -eu
app_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
remote=$(git -C "$app_dir" remote get-url origin)
source_rev=$(git -C "$app_dir" rev-parse --short HEAD)
cd "$app_dir/dist"
touch .nojekyll
rm -rf .git
git init -q -b gh-pages
git add -A
git commit -q -m "Deploy $source_rev"
git push -f "$remote" gh-pages
rm -rf .git
