"""Tests for cash register and session endpoints."""
import pytest


class TestCashRegisters:
    def test_list_registers(self, client, auth_headers, register):
        res = client.get("/api/cash/registers", headers=auth_headers)
        assert res.status_code == 200
        ids = [r["id"] for r in res.json()]
        assert register.id in ids

    def test_create_register(self, client, auth_headers):
        res = client.post("/api/cash/registers", json={"name": "Caja Nueva"}, headers=auth_headers)
        assert res.status_code == 201
        assert res.json()["name"] == "Caja Nueva"
        assert res.json()["is_active"] is True

    def test_duplicate_register_name_returns_409(self, client, auth_headers, register):
        res = client.post("/api/cash/registers", json={"name": "Caja Test"}, headers=auth_headers)
        assert res.status_code == 409

    def test_delete_register(self, client, auth_headers, register):
        res = client.delete(f"/api/cash/registers/{register.id}", headers=auth_headers)
        assert res.status_code in (200, 204)


class TestCashSessions:
    def test_open_session(self, client, auth_headers, register):
        res = client.post("/api/cash/sessions/open", json={
            "register_id": register.id,
            "opening_amount": 30000,
        }, headers=auth_headers)
        assert res.status_code == 201
        data = res.json()
        assert data["status"] == "open"
        assert data["register_id"] == register.id

    def test_cannot_open_two_sessions_on_same_register(self, client, auth_headers, register, open_session):
        res = client.post("/api/cash/sessions/open", json={
            "register_id": register.id,
            "opening_amount": 10000,
        }, headers=auth_headers)
        assert res.status_code == 400

    def test_close_session(self, client, auth_headers, open_session):
        res = client.post(f"/api/cash/sessions/{open_session.id}/close", json={
            "closing_amount": 55000,
        }, headers=auth_headers)
        assert res.status_code == 200
        assert res.json()["status"] == "closed"

    def test_list_sessions(self, client, auth_headers, open_session):
        res = client.get("/api/cash/sessions", headers=auth_headers)
        assert res.status_code == 200
        ids = [s["id"] for s in res.json()["data"]]
        assert open_session.id in ids
