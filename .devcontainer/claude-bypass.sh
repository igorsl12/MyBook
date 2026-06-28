#!/usr/bin/env bash
# Inicia o Claude Code no modo bypass de permissões.
# Use SOMENTE dentro do dev container (ambiente isolado).
set -euo pipefail

if [[ "${IS_SANDBOX:-0}" != "1" ]]; then
  echo "AVISO: IS_SANDBOX != 1 — você parece NÃO estar dentro do container."
  echo "O modo bypass só deve ser usado em ambiente isolado. Abortando."
  exit 1
fi

exec claude --dangerously-skip-permissions "$@"
