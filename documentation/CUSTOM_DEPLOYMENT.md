# Custom deployment

## Server location

- Host: `docker-i5`
- Compose directory: `/opt/stacks/notediscovery`
- Compose file: `/opt/stacks/notediscovery/compose.yml`
- Compose service: `notediscovery`
- Container: `notediscovery`
- Image: `ghcr.io/victortolosa/notediscovery:latest`

## Update the server

Pushes to `custom` build and publish the image. They do not restart the server.
After the `build-custom` GitHub Actions run succeeds, connect to `docker-i5` and
run:

```bash
cd /opt/stacks/notediscovery
docker compose pull notediscovery
docker compose up -d --force-recreate notediscovery
```

## Verify the update

```bash
cd /opt/stacks/notediscovery
docker compose ps notediscovery
docker inspect notediscovery --format '{{.Config.Image}}'
docker exec notediscovery test -f /app/frontend/dist/live-preview.js \
  && echo "Live Preview bundle installed"
docker logs --tail 50 notediscovery
```

The expected image is:

```text
ghcr.io/victortolosa/notediscovery:latest
```

After the container is healthy, hard-refresh the browser with `Cmd+Shift+R` or
`Ctrl+Shift+R`.

## One-command update

Use this only after the GitHub Actions build succeeds:

```bash
cd /opt/stacks/notediscovery && docker compose pull notediscovery && docker compose up -d --force-recreate notediscovery
```

## Roll back

Every custom build is also tagged with its Git commit. To roll back, change the
image in `/opt/stacks/notediscovery/compose.yml` from `latest` to the required
commit SHA, then recreate the service:

```bash
cd /opt/stacks/notediscovery
docker compose pull notediscovery
docker compose up -d --force-recreate notediscovery
```
