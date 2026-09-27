#!/bin/sh
# Default: Docker Compose service name. Override on Render with your backend URL.
API_URL="${API_URL:-http://api:8000}"

# Render's fromService gives "host:port" without protocol — prepend http:// if missing
case "$API_URL" in
  http://*|https://*) ;;
  *) API_URL="http://${API_URL}" ;;
esac
export API_URL

# Only substitute $API_URL — leave nginx variables ($host, $uri, etc.) untouched
envsubst '${API_URL}' < /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf

echo "Starting nginx with API_URL=${API_URL}"
exec nginx -g 'daemon off;'

