"""Tests for sale endpoints: create, list, void, receipt PDF."""
import pytest

from app.models.sale import Sale, SaleItem, SaleStatus, PaymentMethod


def _make_sale(db, register, open_session, product, admin_user):
    """Helper: create a sale directly in DB bypassing the API."""
    sale = Sale(
        sale_number=1,
        cash_session_id=open_session.id,
        register_id=register.id,
        seller_id=admin_user.id,
        subtotal=float(product.sell_price),
        tax_amount=round(float(product.sell_price) * 19 / 119, 2),
        total=float(product.sell_price),
        payment_method=PaymentMethod.CASH,
        cash_amount=float(product.sell_price),
        change_amount=0.0,
        status=SaleStatus.COMPLETED,
        discount_amount=0.0,
        points_earned=0,
        points_redeemed=0,
    )
    db.add(sale)
    db.flush()
    item = SaleItem(
        sale_id=sale.id,
        product_id=product.id,
        product_name=product.name,
        product_sku=product.sku,
        quantity=1,
        unit_price=float(product.sell_price),
        subtotal=float(product.sell_price),
        tax_rate=float(product.tax_rate),
        tax_amount=round(float(product.sell_price) * 19 / 119, 2),
    )
    db.add(item)
    db.commit()
    db.refresh(sale)
    return sale


class TestCreateSale:
    def test_create_sale_deducts_stock(self, client, auth_headers, db, product, register, open_session, admin_user):
        initial_stock = product.stock
        res = client.post("/api/sales/", json={
            "cash_session_id": open_session.id,
            "register_id": register.id,
            "payment_method": "cash",
            "cash_amount": float(product.sell_price),
            "items": [{"product_id": product.id, "quantity": 2}],
        }, headers=auth_headers)
        assert res.status_code == 201
        db.refresh(product)
        assert product.stock == initial_stock - 2

    def test_create_sale_insufficient_stock_returns_400(self, client, auth_headers, product, register, open_session):
        res = client.post("/api/sales/", json={
            "cash_session_id": open_session.id,
            "register_id": register.id,
            "payment_method": "cash",
            "cash_amount": 999999,
            "items": [{"product_id": product.id, "quantity": 9999}],
        }, headers=auth_headers)
        assert res.status_code == 400

    def test_create_sale_closed_session_returns_400(self, client, auth_headers, db, product, register, open_session):
        from app.models.cash_register import SessionStatus
        open_session.status = SessionStatus.CLOSED
        db.commit()
        res = client.post("/api/sales/", json={
            "cash_session_id": open_session.id,
            "register_id": register.id,
            "payment_method": "cash",
            "cash_amount": float(product.sell_price),
            "items": [{"product_id": product.id, "quantity": 1}],
        }, headers=auth_headers)
        assert res.status_code == 400


class TestGetSale:
    def test_get_sale_by_id(self, client, auth_headers, db, product, register, open_session, admin_user):
        sale = _make_sale(db, register, open_session, product, admin_user)
        res = client.get(f"/api/sales/{sale.id}", headers=auth_headers)
        assert res.status_code == 200
        assert res.json()["id"] == sale.id
        assert len(res.json()["items"]) == 1

    def test_list_sales_returns_paginated(self, client, auth_headers, db, product, register, open_session, admin_user):
        _make_sale(db, register, open_session, product, admin_user)
        res = client.get("/api/sales/", headers=auth_headers)
        assert res.status_code == 200
        body = res.json()
        assert "data" in body
        assert body["meta"]["total"] >= 1


class TestVoidSale:
    def test_void_completed_sale(self, client, auth_headers, db, product, register, open_session, admin_user):
        sale = _make_sale(db, register, open_session, product, admin_user)
        res = client.post(f"/api/sales/{sale.id}/void", headers=auth_headers)
        assert res.status_code == 200
        assert res.json()["status"] == "voided"

    def test_void_already_voided_sale_returns_400(self, client, auth_headers, db, product, register, open_session, admin_user):
        sale = _make_sale(db, register, open_session, product, admin_user)
        # Void once
        client.post(f"/api/sales/{sale.id}/void", headers=auth_headers)
        # Try to void again
        res = client.post(f"/api/sales/{sale.id}/void", headers=auth_headers)
        assert res.status_code == 400


class TestReceiptPdf:
    def test_receipt_pdf_returns_pdf_content_type(self, client, auth_headers, db, product, register, open_session, admin_user):
        sale = _make_sale(db, register, open_session, product, admin_user)
        res = client.get(f"/api/sales/{sale.id}/receipt.pdf", headers=auth_headers)
        assert res.status_code == 200
        assert res.headers["content-type"] == "application/pdf"
        assert len(res.content) > 100  # non-empty PDF

    def test_receipt_pdf_nonexistent_sale_returns_404(self, client, auth_headers):
        res = client.get("/api/sales/nonexistent-id/receipt.pdf", headers=auth_headers)
        assert res.status_code == 404
