app = "animebot72"
primary_region = "gru"

[build]
  dockerfile = "Dockerfile"

[machines]
  memory = "4096mb"
  cpus = 4

[env]
  DISPLAY = ":99"
  DEBIAN_FRONTEND = "noninteractive"

[[services]]
  protocol = "tcp"
  internal_port = 6080
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

  [[services.ports]]
    port = 80
    handlers = ["http"]

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
