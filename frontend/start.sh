#!/bin/sh
# Pick up API_URL or fallback to VITE_API_URL, default to local docker service
API_URL="${API_URL:-${VITE_API_URL:-http://api:8000}}"

# Trim trailing slash if present
API_URL="${API_URL%/}"

# Ensure proper protocol prefix
case "$API_URL" in
  http://*|https://*) ;;
  *onrender.com*) API_URL="https://${API_URL}" ;;
  localhost*|api:*) API_URL="http://${API_URL}" ;;
  *) API_URL="https://${API_URL}" ;;
esac

export API_URL

# Only substitute $API_URL — leave nginx variables ($host, $uri, etc.) untouched
envsubst '${API_URL}' < /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf

echo "Starting nginx with API_URL=${API_URL}"
cat /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
