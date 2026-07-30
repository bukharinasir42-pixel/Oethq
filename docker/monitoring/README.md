# Monitoring Stack

This folder provides a lightweight local and staging-ready monitoring setup for the Phase 3 `/metrics` endpoint.

## What is included
- `prometheus.yml`: scrapes the backend metrics endpoint every 30 seconds.
- `alerts.yml`: basic launch alerts for backend uptime and purchase-health drift.
- `alertmanager.yml`: placeholder webhook delivery config.
- `../docker-compose.monitoring.yml`: spins up Prometheus and Alertmanager.

## Start locally
```bash
cd docker
docker compose -f docker-compose.monitoring.yml up -d
```

## Assumptions
- The backend is reachable at `http://host.docker.internal:4000/metrics`.
- Alert delivery currently points at `http://host.docker.internal:4010/alerts`.

## Before staging or production
- Replace the placeholder Alertmanager webhook receiver with your real Slack, email, PagerDuty, or webhook target.
- Update the Prometheus scrape target if the backend runs behind a different hostname or port.
- Validate all three launch alerts by intentionally stopping the backend and by creating failed purchases in the staging checkout flow.
