"""Tests for product endpoints (CRUD, soft delete, T3 regression)."""
import pytest


class TestListProducts:
    def test_returns_active_products(self, client, auth_headers, product):
        res = client.get("/api/products/", headers=auth_headers)
        assert res.status_code == 200
        # Products list returns a plain list (not paginated envelope)
        names = [p["name"] for p in res.json()]
        assert "Producto Test" in names

    def test_soft_deleted_products_excluded_from_list(self, client, auth_headers, product, db):
        product.is_active = False
        db.commit()
        res = client.get("/api/products/", headers=auth_headers)
        names = [p["name"] for p in res.json()]
        assert "Producto Test" not in names


class TestGetProduct:
    def test_get_existing_product(self, client, auth_headers, product):
        res = client.get(f"/api/products/{product.id}", headers=auth_headers)
        assert res.status_code == 200
        assert res.json()["id"] == product.id

    def test_get_nonexistent_product_returns_404(self, client, auth_headers):
        res = client.get("/api/products/nonexistent-id", headers=auth_headers)
        assert res.status_code == 404

    def test_get_soft_deleted_product_returns_404(self, client, auth_headers, product, db):
        """T3: GET by ID must respect is_active filter."""
        product.is_active = False
        db.commit()
        res = client.get(f"/api/products/{product.id}", headers=auth_headers)
        assert res.status_code == 404


class TestCreateProduct:
    def test_create_product_succeeds(self, client, auth_headers):
        res = client.post("/api/products/", json={
            "name": "Nuevo Producto",
            "sku": "NEW-001",
            "sell_price": 2500,
            "cost_price": 1200,
            "stock": 10,
            "tax_rate": 19.0,
        }, headers=auth_headers)
        assert res.status_code == 201
        data = res.json()
        assert data["name"] == "Nuevo Producto"
        assert data["sku"] == "NEW-001"
        assert data["is_active"] is True

    def test_duplicate_sku_rejected(self, client, auth_headers, product):
        """Duplicate SKU is enforced by DB unique constraint — any 4xx/5xx is a pass."""
        res = client.post("/api/products/", json={
            "name": "Duplicado",
            "sku": "TEST-SKU-001",  # same as fixture
            "sell_price": 500,
            "cost_price": 200,
            "stock": 5,
        }, headers=auth_headers)
        assert res.status_code >= 400


class TestUpdateProduct:
    def test_update_price(self, client, auth_headers, product):
        res = client.put(f"/api/products/{product.id}", json={
            "sell_price": 1500,
        }, headers=auth_headers)
        assert res.status_code == 200
        assert float(res.json()["sell_price"]) == 1500.0

    def test_update_nonexistent_product_returns_404(self, client, auth_headers):
        res = client.put("/api/products/nonexistent-id", json={"sell_price": 999}, headers=auth_headers)
        assert res.status_code == 404


class TestDeleteProduct:
    def test_delete_marks_inactive(self, client, auth_headers, product):
        res = client.delete(f"/api/products/{product.id}", headers=auth_headers)
        assert res.status_code in (200, 204)
        # Subsequent GET should return 404
        get_res = client.get(f"/api/products/{product.id}", headers=auth_headers)
        assert get_res.status_code == 404
