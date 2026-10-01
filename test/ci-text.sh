#!/bin/sh
# Extract a bill's text exactly as CI does (Ubuntu 24.04 pdftotext), using Docker on a LAN host.
# usage: test/ci-text.sh <camara id> [host]   -> prints text to stdout
id=$1; host=${2:-pulu@192.168.50.10}
url=$(curl -s -H 'accept: application/json' "https://dadosabertos.camara.leg.br/api/v2/proposicoes/$id" | grep -o '"urlInteiroTeor":"[^"]*"' | cut -d'"' -f4)
ssh -o BatchMode=yes "$host" "docker run --rm ubuntu:24.04 sh -c 'apt-get update -qq >/dev/null && apt-get install -y -qq --no-install-recommends poppler-utils curl ca-certificates >/dev/null 2>&1 && curl -s \"$url\" -o a.pdf && pdftotext -raw -enc UTF-8 a.pdf -'"
