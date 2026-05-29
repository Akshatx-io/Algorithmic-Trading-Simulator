"""
Infrastructure adapters — Redis, event bus, WebSocket manager, ML loader, etc.

This package is the only place I/O clients live. Anything that talks to the
outside world (DB driver, cache, external HTTP) belongs here. Domain and
service layers depend on `app.infra` but `app.infra` depends on nothing in
the rest of the app.
"""
