"""Tests for authentication endpoints: login, refresh, logout."""
import pytest


class TestLoginPin:
    def test_valid_pin_returns_tokens(self, client, admin_user):
        res = client.post("/api/users/login/pin", json={"pin": "9999"})
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["access_token"]
        assert data["refresh_token"]
        assert data["token_type"] == "bearer"
        assert data["expires_in"] > 0
        assert data["user"]["username"] == "test_admin"
        assert data["user"]["role"] == "admin"

    def test_invalid_pin_returns_401(self, client, admin_user):
        res = client.post("/api/users/login/pin", json={"pin": "0000"})
        assert res.status_code == 401

    def test_inactive_user_cannot_login(self, client, db, admin_user):
        admin_user.is_active = False
        db.commit()
        res = client.post("/api/users/login/pin", json={"pin": "9999"})
        assert res.status_code == 401


class TestTokenRefresh:
    def test_valid_refresh_token_issues_new_tokens(self, client, admin_user):
        login = client.post("/api/users/login/pin", json={"pin": "9999"})
        refresh_token = login.json()["data"]["refresh_token"]

        res = client.post("/api/users/refresh", json={"refresh_token": refresh_token})
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["access_token"]
        assert data["refresh_token"]
        # Refresh token should be rotated
        assert data["refresh_token"] != refresh_token

    def test_invalid_refresh_token_returns_401(self, client, admin_user):
        res = client.post("/api/users/refresh", json={"refresh_token": "invalid-token"})
        assert res.status_code == 401

    def test_used_refresh_token_cannot_be_reused(self, client, admin_user):
        """After rotating, the old refresh token must be rejected."""
        login = client.post("/api/users/login/pin", json={"pin": "9999"})
        old_refresh = login.json()["data"]["refresh_token"]

        # Use it once
        client.post("/api/users/refresh", json={"refresh_token": old_refresh})

        # Try to reuse the old token
        res = client.post("/api/users/refresh", json={"refresh_token": old_refresh})
        assert res.status_code == 401


class TestLogout:
    def test_logout_revokes_refresh_token(self, client, admin_user):
        login = client.post("/api/users/login/pin", json={"pin": "9999"})
        access_token = login.json()["data"]["access_token"]
        refresh_token = login.json()["data"]["refresh_token"]

        res = client.post(
            "/api/users/logout",
            json={"refresh_token": refresh_token},
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert res.status_code == 204

        # After logout, refresh token should be revoked
        refresh_res = client.post("/api/users/refresh", json={"refresh_token": refresh_token})
        assert refresh_res.status_code == 401


class TestProtectedRoutes:
    def test_protected_route_without_token_returns_401(self, client):
        res = client.get("/api/products/")
        assert res.status_code == 401

    def test_protected_route_with_valid_token_succeeds(self, client, auth_headers):
        res = client.get("/api/products/", headers=auth_headers)
        assert res.status_code == 200

    def test_admin_only_route_rejects_cashier(self, client, cashier_user):
        login = client.post("/api/users/login/pin", json={"pin": "1111"})
        token = login.json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        # POST /api/users/ is admin-only
        res = client.post("/api/users/", json={
            "username": "new_user", "pin": "2222", "full_name": "New", "role": "cashier"
        }, headers=headers)
        assert res.status_code == 403
