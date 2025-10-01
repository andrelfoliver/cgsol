#!/bin/sh
set -e

host="$DB_HOST"
port="${DB_PORT:-5432}"

echo "Aguardando o banco de dados em $host:$port..."

until nc -z "$host" "$port"; do
  sleep 1
done

echo "Banco de dados está pronto! Iniciando o backend..."

exec "$@"
