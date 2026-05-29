"""
Service layer — orchestration, transaction boundaries, cross-cutting concerns.

Services are the only place where multiple repositories are coordinated and
where domain events are emitted. Routes call services; services call domain
logic + repositories; repositories own all I/O.

Phase 2.1 ships `auth_service` as the prototype. Phase 2.3 extracts
order_service, portfolio_service, etc.
"""

from app.services.auth_service import AuthService, auth_service

__all__ = ["AuthService", "auth_service"]
